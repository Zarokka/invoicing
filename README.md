## Stuff to generate invoices from a HTML Template

Contains a html template for invoices (text in german) that can be filled with data using mustache
and converted to pdf using node-html-pdf.

It also contains an empty sqlite db and a CLI to add and export invoices from this db.

**Warning: This is not a sophisticated solution (more the quick and dirty type).**

### Content

#### invoice_template_de_AT.html

The template contains CSS/HTML and mustaches.
It is formatted for single page invoice for Austria (therefor in German).

### example

Contains test data and an example output html + pdf.

```
mustache test_data.yml ../invoice_template_de_AT.html > invoice_example.html
html-pdf invoice_example.html invoice_example.pdf
```

see: [Mustache](http://mustache.github.io/) and [node-html-pdf](https://github.com/marcbachmann/node-html-pdf)

Note: I could not get wkhtmltopdf to format the output correctly (had to remove the margins from the template and then the footer was still a problem).

### invoice-node-cli

Contains an empty sqlite db and a node based CLI to add and generate invoices.

#### Usage

- Copy invoice.sqlite to a location of your choice.
- Use a SQLite management tool to add biller, customer, banking and item information
    - e.g. [SQLiteBrowser](http://sqlitebrowser.org/)
    - the id is always an alphanumeric value you have to enter your self
    - biller: this table is for your companies base information
    - banking: this table is for your companies banking information (only one entry supported by the CLI)
    - customer: this table is for your customer data
    - item: this table contains the items that may be added to an invoice (they may be customer bound)
    - invoice and invoice_item: contain the invoice information (this is added by the CLI)

- Use the CLI to generate invoices
    - execute in the invoice-node-cli directory: npm install
```
./invc.js <db> <template> <outputpath> [locale]
```
    - db: path to db
    - template: path to template
    - outputpath: path where html and pdf should be saved
    - locale: optional locale (only used to format numbers)

## License

MIT see LICENSE.md
