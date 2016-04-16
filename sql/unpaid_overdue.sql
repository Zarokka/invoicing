select c.name, i.id, i.due_date, i.total_net as charged, p.amount as paid, (i.total_net - ifnull(p.amount, 0)) as diff
from invoice i
join customer c on i.customer_id = c.id
left outer join payment p on p.invoice_id = i.id
where (p.amount is null or p.amount < i.total_net)
	and date('now') > i.due_date