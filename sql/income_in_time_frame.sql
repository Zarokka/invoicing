select sum(i.total_net) as net, sum(i.total_tax) as tax, sum(i.total_gross) as gross
from invoice i
join payment p on p.invoice_id = i.id
where p.payment_date between '2016-03-31' and '2016-06-30'