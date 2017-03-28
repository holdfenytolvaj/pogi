--insert into "groups" (name) values ('joe');
select * from "groups" where name like 'joe--'; ; ; -- select * from "groups" where name like 'joe';
select * from "groups" where name like $$joe2'"-- ;
-- not a comment ;
$$;
