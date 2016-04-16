#!/usr/bin/env node

/**
 * A quick and dirty CLI to generate invoices, save them to the db and export them to pdf.
 * Written by a node and javaScript noob.
 */

var program = require('commander');
var sqlite3 = require('sqlite3').verbose();
var inquirer = require('inquirer');
var dateFormat = require('dateformat');
var mustache = require('mustache');
var fs = require('fs');
var pdf = require('html-pdf');
var open = require('open');

program.version('0.0.1').usage('<db> <template> <outputpath> [locale]');

program.parse(process.argv);

if (program.args.length < 3) {
    console.error('No enough arguments');
    process.exit(1);
}

var dbpath = program.args[0];
console.log('Using DB %s', dbpath);
var db = new sqlite3.Database(dbpath);

var templatepath = program.args[1];
console.log('Using template %s', templatepath);
var outpath = program.args[2];
console.log('Using output path %s', outpath);

var locale = null;
if (program.args.length > 3) {
    locale = program.args[3];
}

function closeDb() {
    db.close();
}

function exitOk() {
    closeDb();
    process.exit(0);
}

function exitWithError(err) {
    closeDb();
    console.error(err);
    process.exit(1);
}

function exportInvoiceHtmlPdf(invoice, callback) {
    fs.readFile(templatepath, 'utf8', function(err, data) {
        if (err) {
            return callback(err);
        }
        console.log("Template read.");
        var html = mustache.to_html(data, invoice);
        console.log("Html generated.");
        var outfile = outpath + "/invoice_" + invoice.id + ".html";
        fs.writeFile(outfile, html, function(err) {
            if (err) return callback(err);

            console.log("Html invoice written to: " + outfile);
            var outfilepdf = outpath + "/invoice_" + invoice.id + ".pdf";
            //var options = { format: 'Letter' };

            pdf.create(html).toFile(outfilepdf, function(err, res) {
                if (err) return callback(err);

                console.log("PDF invoice written to: " + outfilepdf);

                open(outfilepdf);
                callback();
            });

        });
    });
}

function addBiller(invoice, billerId, callback) {

    var sql =
        'select * from biller bi \
                join banking ba on ba.biller_id = bi.id \
                where bi.id = ?';

    db.get(sql, billerId, function(err, row) {
        if (err) {
            callback(err);
            return;
        }
        console.log("Loaded biller.");

        var biller = {};
        biller.name = row.name;
        biller.street = row.street;
        biller.postal = row.postal;
        biller.city = row.city;
        biller.taxId = row.tax_id;

        var banking = {};
        banking.iban = row.iban;
        banking.swift = row.swift;
        banking.institute = row.institute;
        biller.banking = banking;

        invoice.biller = biller;

        callback();
    });
}

function addCustomer(invoice, customerId, callback) {

    db.get('select * from customer where id = ?', customerId, function(err, row) {
        if (err) {
            callback(err);
            return;
        }
        console.log("Loaded customer.");

        var customer = {};
        customer.name = row.name;
        customer.street = row.street;
        customer.postal = row.postal;
        customer.city = row.city;
        customer.taxId = row.tax_id;
        customer.termsAmount = row.terms_amount;

        invoice.customer = customer;

        callback();
    });
}

function numToLocale(num) {
    if (locale !== null) {
        return num.toLocaleString(locale, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        });
    }

    return num.toLocaleString({
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
}

function updateExportDateIfNotSet(invoiceId, callback) {
    db.run('update invoice SET export_date = ? WHERE id = ? and export_date is null',
        dateFormat(new Date(), "yyyy-mm-dd"), invoiceId,
        function(err) {
            if (err) return callback(err);

            callback();
        });
}

function exportInvoice(invoiceId, callback) {
    console.log("Exporting invoice %s.", invoiceId);

    db.serialize(function() {
        var sql =
            'select * from invoice iv \
                    join invoice_item it on it.invoice_id = iv.id \
                    where iv.id = ? \
                    order by it.position';

        db.all(sql, invoiceId, function(err, rows) {
            if (err) return callback(err);

            console.log("Loaded items.");
            var row = rows[0];

            var invoice = {};

            invoice.id = row.id;
            invoice.date = row.issue_date;
            invoice.periodeFrom = row.periode_from;
            invoice.periodeTo = row.periode_to;
            invoice.totalNet = numToLocale(row.total_net);
            invoice.totalTax = numToLocale(row.total_tax);
            invoice.totalGross = numToLocale(row.total_gross);

            invoice.items = [];

            var i;
            for (i in rows) {

                row = rows[i];
                var item = {};
                item.description = row.description;
                item.unit = row.unit;
                item.unitPrice = numToLocale(row.unit_price);
                item.quantity = numToLocale(row.quantity);
                item.priceNet = numToLocale(row.price_net);
                //TODO mixed tax percentages currently not possible (not in the template)
                invoice.taxPercentage = row.tax_percentage;
                invoice.items.push(item);
            }

            addBiller(invoice, row.biller_id, function(err) {
                if (err) return callback(err);

                addCustomer(invoice, row.customer_id, function(err) {
                    if (err) return callback(err);

                    invoice.termsAmount = invoice.customer.termsAmount;

                    updateExportDateIfNotSet(invoice.id, function(err) {
                        if (err) return callback(err);

                        exportInvoiceHtmlPdf(invoice, function(err) {
                            if (err) return callback(err);

                            callback();
                        });
                    });
                });
            });
        });
    });
}

function updateInvoiceSums(invoice, callback) {
    db.run('update invoice SET currency = ?, total_net = ?, total_tax = ?, total_gross = ? WHERE id = ?',
        invoice.currency, invoice.totalNet, invoice.totalTax, invoice.totalNet + invoice.totalTax, invoice.id,
        function(err) {
            if (err) {
                callback(err);
            } else {
                console.log("Invoice totals updated. Total net: %s%s", invoice.totalNet.toFixed(2), invoice.currency);
                callback();
            }
        });
}

function saveInvoiceItems(invoice, index, callback) {

    if (typeof invoice.totalNet === 'undefined') invoice.totalNet = 0;
    if (typeof invoice.totalTax === 'undefined') invoice.totalTax = 0;
    if (typeof invoice.currency === 'undefined') invoice.currency = "€";

    if (index >= invoice.items.length) {
        updateInvoiceSums(invoice, callback);
        return;
    }

    var item = invoice.items[index];

    db.get('select * from  item where id = ?', item.id, function(err, row) {
        if (err) exitWithError(err);

        var itemNetPrice = row.unit_price * item.quantity;
        itemNetPrice = Math.round(itemNetPrice * 100) / 100;
        invoice.totalNet += itemNetPrice;
        var itemTax = itemNetPrice * (row.tax_percentage / 100.0);
        itemTax = Math.round(itemTax * 100) / 100;
        invoice.totalTax += itemTax;

        invoice.currency = row.currency;

        db.run(
            'insert into invoice_item \
				(invoice_id,  position, description, unit, unit_price, tax_percentage, quantity, price_net) \
				values (?, ?, ?, ?, ?, ?, ?, ?)',
            invoice.id, index, row.description, row.unit, row.unit_price, row.tax_percentage, item.quantity,
            itemNetPrice,
            function(err) {
                if (err) {
                    callback(err);
                } else {
                    console.log("Invoice item %d inserted. Item net: %s%s",
                        index, itemNetPrice.toFixed(2), invoice.currency);
                    saveInvoiceItems(invoice, index + 1, callback);
                }
            });
    });
}

function saveInvoice(invoice, callback) {
    console.log("Saving Invoice.");
    db.serialize(function() {
        db.run(
            'insert into invoice (id, issue_date, biller_id, customer_id, periode_from, periode_to, due_date) \
            values (?, ?, ?, ?, ?, ?, ?)', [
                invoice.id, invoice.date, invoice.billerId, invoice.customerId, invoice.periodeFrom,
                invoice.periodeTo,
                invoice.dueDate
            ],
            function(err) {
                if (err) {
                    callback(err);
                } else {
                    console.log("Invoice basics inserted");
                    saveInvoiceItems(invoice, 0, callback);
                }
            });
    });
}

function calculateInvoiceDueDate(invoice, callback) {
    console.log("Calculating due date.");

    addCustomer(invoice, invoice.customerId, function(err) {
        if (err) return callback(err);

        var dueDate = new Date(invoice.date);
        dueDate.setDate(dueDate.getDate() + invoice.customer.termsAmount);

        invoice.dueDate = dateFormat(dueDate, "yyyy-mm-dd");
        console.log("Due date: " + invoice.dueDate);

        callback();
    });
}

function newInvoice(invoice) {

    if (typeof invoice === 'undefined') {
        db.all("SELECT id, name FROM biller", function(err, rows) {
            if (err) exitWithError(err);

            var choices = [];
            var i;
            for (i in rows) {
                choices.push(rows[i].id + ": " + rows[i].name);
            }

            inquirer.prompt([{
                type: "rawlist",
                name: "biller",
                message: "Choose biller:",
                choices: choices
            }], function(answers) {
                newInvoice({
                    billerId: answers.biller.split(":")[0]
                });
            });

        });
    } else if (typeof invoice.customerId === 'undefined') {
        db.all("SELECT id, name FROM customer", function(err, rows) {
            if (err) exitWithError(err);

            var choices = [];
            var i;
            for (i in rows) {
                choices.push(rows[i].id + ": " + rows[i].name);
            }

            inquirer.prompt([{
                type: "rawlist",
                name: "customer",
                message: "Choose customer:",
                choices: choices
            }], function(answers) {
                invoice.customerId = answers.customer.split(":")[0];
                newInvoice(invoice);
            });

        });
    } else if (typeof invoice.id === 'undefined') {
        db.all("select max(id) as maxid from invoice", function(err, rows) {
            if (err) exitWithError(err);
            var newInvoiceId = '2016-0001';
            if (rows.length > 0) {
                var tmp = rows[0].maxid;
                if (tmp !== null) {
                    var newNum = parseInt(tmp.substring(tmp.length - 4, tmp.length)) + 1;
                    newInvoiceId = tmp.substring(0, tmp.length - 4) + ('000' + newNum).substr(-4);
                }
            }
            inquirer.prompt([{
                type: "input",
                name: "invoiceId",
                message: "Enter invoice id:",
                default: function() {
                    return newInvoiceId;
                }
            }], function(answers) {
                invoice.id = answers.invoiceId;
                newInvoice(invoice);
            });

        });
    } else if (typeof invoice.date === 'undefined') {
        inquirer.prompt([{
            type: "input",
            name: "invoiceDate",
            message: "Enter invoice date:",
            default: function() {
                return dateFormat(new Date(), "yyyy-mm-dd");
            }
        }], function(answers) {
            invoice.date = answers.invoiceDate;
            newInvoice(invoice);
        });
    } else if (typeof invoice.periodeFrom === 'undefined') {
        inquirer.prompt([{
            type: "input",
            name: "periodeFrom",
            message: "Enter activity periode start date:",
            default: function() {
                var today = new Date();
                var firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                return dateFormat(firstDayOfLastMonth, "yyyy-mm-dd");
            }
        }, {
            type: "input",
            name: "periodeTo",
            message: "Enter activity periode end date:",
            default: function() {
                var today = new Date();
                var lastDayLastOfMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                return dateFormat(lastDayLastOfMonth, "yyyy-mm-dd");
            }
        }], function(answers) {
            invoice.periodeFrom = answers.periodeFrom;
            invoice.periodeTo = answers.periodeTo;
            newInvoice(invoice);
        });
    } else {
        db.all('select * from  item where customer_id = "' + invoice.customerId + '" or customer_id is null',
            function(err, rows) {
                if (err) exitWithError(err);
                var choices = [];
                var i;
                for (i in rows) {
                    choices.push(rows[i].id + ": " + rows[i].caption + ", " + rows[i].unit + ", " + rows[i].unit_price +
                        " " + rows[i].currency);
                }
                choices.push("No more items.");

                inquirer.prompt([{
                    type: "rawlist",
                    name: "item",
                    message: "Choose item to add:",
                    choices: choices
                }], function(answers) {
                    if (answers.item === "No more items.") {

                        calculateInvoiceDueDate(invoice, function(err) {
                            if (err) return exitWithError(err);

                            saveInvoice(invoice, function(err) {
                                if (err) return exitWithError(err);

                                exportInvoice(invoice.id, function(err) {
                                    if (err) {
                                        exitWithError(err);
                                    } else {
                                        exitOk();
                                    }
                                });
                            });
                        });
                    } else {
                        var itemId = answers.item.split(":")[0];
                        inquirer.prompt([{
                            type: "input",
                            name: "quantity",
                            message: "Enter item quantity:"
                        }], function(answers) {
                            if (typeof invoice.items === 'undefined') {
                                invoice.items = [];
                            }
                            invoice.items.push({
                                id: itemId,
                                quantity: parseFloat(answers.quantity.replace(",", "."))
                            });
                            newInvoice(invoice);
                        });
                    }
                });

            });
    }

}

function exportExistingInvoice() {
    inquirer.prompt([{
        type: "input",
        name: "invoiceId",
        message: "Enter invoice id:"
    }], function(answers) {
        exportInvoice(answers.invoiceId, function(err) {
            if (err) {
                exitWithError(err);
            } else {
                exitOk();
            }
        });
    });
}

inquirer.prompt([{
    type: "rawlist",
    name: "action",
    message: "What do you want to do?",
    choices: [
        "New invoice",
        "Export existing invoice"
    ]
}], function(answers) {
    if (answers.action === "New invoice") {
        newInvoice();
    } else {
        exportExistingInvoice();
    }
});
