select c.name, charged, paid, (charged - paid) as diff
from customer c
join (select i.customer_id, sum(i.total_gross) as charged
		from invoice i
		group by i.customer_id) as isum on isum.customer_id = c.id
left outer join 
	(select p.customer_id, sum(p.amount) as paid
		from payment p
		group by p.customer_id) as psum on psum.customer_id = c.id
group by c.name
