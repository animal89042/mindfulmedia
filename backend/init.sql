CREATE DATABASE IF NOT EXISTS mindfulmedia;
USE mindfulmedia;

CREATE TABLE IF NOT EXISTS users (
  steam_id      VARCHAR(50) PRIMARY KEY,
  displayname  VARCHAR(255),
  personaname  VARCHAR(255),
  avatar       VARCHAR(512),
  profile_url  VARCHAR(512)
);

CREATE TABLE IF NOT EXISTS games (
  appid      BIGINT PRIMARY KEY,
  title      VARCHAR(255),
  image_url  TEXT,
  category   TEXT
);

CREATE TABLE IF NOT EXISTS user_games (
  steam_id  VARCHAR(50),
  appid     BIGINT,
  PRIMARY KEY (steam_id, appid),
  FOREIGN KEY (steam_id) REFERENCES users (steam_id),
  FOREIGN KEY (appid)    REFERENCES games (appid)
);