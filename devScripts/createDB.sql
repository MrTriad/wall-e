CREATE TABLE IF NOT EXISTS origin(
	_id_origin serial PRIMARY KEY,
	domain varchar(255) NOT NULL,
	name varchar(255),
	is_dead_score int DEFAULT 0,
	category int NOT NULL,
	last_checked int, -- No buono, un po' una toppa
	last_url varchar(1024) -- non mi lascia fare il link :/
);

CREATE TABLE IF NOT EXISTS author(
	_id_author serial PRIMARY KEY,
	tag varchar(255),
	username varchar(255) NOT NULL,
	description varchar(255),
	UNIQUE (tag, username)
);

CREATE TABLE IF NOT EXISTS source(
    _id_source serial PRIMARY KEY,
    spam_score int DEFAULT 0,
    published_time timestamptz,
    crawled_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    _id_origin int NOT NULL,
    _id_author int,
    CONSTRAINT _fk_origin
		FOREIGN KEY(_id_origin)
			REFERENCES origin(_id_origin)
			ON DELETE RESTRICT
			ON UPDATE CASCADE,
	CONSTRAINT _fk_author
		FOREIGN KEY(_id_author)
			REFERENCES author(_id_author)
			ON DELETE RESTRICT
			ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS source_thread(
	_id_source_thread serial PRIMARY KEY,
	url varchar(1023) NOT NULL,
	title varchar(255) NOT NULL,
	description varchar(32767) NOT NULL,
	replies_count int,
	views_count int,
	_id_source int,
	CONSTRAINT _fk_source
		FOREIGN KEY(_id_source)
			REFERENCES source(_id_source)
			ON DELETE RESTRICT
			ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS source_telegram(
	_id_source_telegram int, -- This i the local ID of the messages. A serial ID growing in every channel
	message_text varchar(4096) NOT NULL,
    views_count int,
	shares_count int,
	_id_source int,	-- FIXME per come è fatto potrebbe anche essere chiave unica, ma non trovo grandi fonti. Andrebbe revisionato con uno che ne sa ahah
	CONSTRAINT _fk_source	
		FOREIGN KEY(_id_source)
			REFERENCES source(_id_source)
			ON DELETE RESTRICT
			ON UPDATE CASCADE,
	PRIMARY KEY (_id_source_telegram, _id_source)
);

CREATE TABLE IF NOT EXISTS database_metadata(
	_og_hashMD5 char(32) PRIMARY KEY,
	name varchar(255),
	breach_time timestamptz DEFAULT now(),
	og_filename varchar(255),
	is_hashed bool,
	is_salted bool,
	_id_source int,
	CONSTRAINT _fk_source
		FOREIGN KEY(_id_source)
			REFERENCES source(_id_source)
			ON DELETE RESTRICT
			ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS forum_path(
	_id_forum_path serial PRIMARY KEY,
	next_page_path varchar(255) NOT NULL,
	table_body_path varchar(255) NOT NULL,
	thread_link_path varchar(255) NOT NULL,
	thread_title_path varchar(255) NOT NULL,
	thread_description_path varchar(255) NOT NULL,
	thread_pubblication_date_path varchar(255) NOT NULL,
	is_auto_generated bool NOT NULL,
	_id_origin int NOT NULL,
	CONSTRAINT _fk_origin
		FOREIGN KEY(_id_origin)
			REFERENCES origin(_id_origin)
			ON DELETE RESTRICT
			ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS data(
	_id_data serial PRIMARY KEY,
	email_address varchar(255),
	phone_number varchar(63),
	ip_address varchar(15),
	username varchar(127),
	misc json,
	_og_hashmd5 char(32) NOT NULL,
	CONSTRAINT _fk_database_metadata
		FOREIGN KEY(_og_hashmd5)
			REFERENCES database_metadata(_og_hashmd5)
			ON DELETE CASCADE
			ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS origin_history(
	_id_origin_history serial PRIMARY KEY,
	additional_infos varchar(16383),
	updated_time timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
	_id_origin int NOT NULL,
	CONSTRAINT _fk_origin
		FOREIGN KEY(_id_origin)
			REFERENCES origin(_id_origin)
			ON DELETE RESTRICT
			ON UPDATE CASCADE
);