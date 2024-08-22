DROP TABLE IF EXISTS dwd_mosmix;
CREATE TABLE IF NOT EXISTS dwd_mosmix
(
	id SERIAL PRIMARY KEY,
	stationsid VARCHAR,
	stationsname VARCHAR,
	zeitpunkt TIMESTAMP,
	Wolkenbedeckung INT,
	Niederschlag_letzte_Stunde FLOAT,
	Temperatur FLOAT,
	Windboen_letzte_Stunde INT,
	Windgeschwindigkeit INT,
	Windrichtung INT,
	Druck_auf_Meereshoehe FLOAT,
	shape GEOMETRY,
    modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);