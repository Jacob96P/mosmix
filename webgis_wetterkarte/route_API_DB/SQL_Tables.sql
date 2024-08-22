

DROP TABLE IF EXISTS toern CASCADE;
CREATE TABLE IF NOT EXISTS toern
(
    toern_id UUID,
	benutzer VARCHAR,
	toern_name VARCHAR,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(toern_id)
);

DROP TABLE IF EXISTS route;
CREATE TABLE IF NOT EXISTS route
(
	route_id UUID,
	toern_id UUID,
	benutzer VARCHAR,
	toern_name VARCHAR,
	route_name VARCHAR,
	geom GEOMETRY,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(route_id),
	CONSTRAINT fk_toern_id
      FOREIGN KEY(toern_id)
      REFERENCES toern(toern_id)
	  ON DELETE CASCADE
);



