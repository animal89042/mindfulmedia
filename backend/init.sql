CREATE DATABASE IF NOT EXISTS mindfulmedia;
USE mindfulmedia;

CREATE TABLE IF NOT EXISTS users (
  steam_id      VARCHAR(50) PRIMARY KEY,
  display_name  VARCHAR(255),
  persona_name  VARCHAR(255),
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

CREATE TABLE IF NOT EXISTS journals (
  id BIGINT AUTO_INCREMENT,
  steam_id   VARCHAR(50),
  appid          BIGINT,
  entry          TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  title VARCHAR(255),
  PRIMARY KEY (id),
  FOREIGN KEY (steam_id) REFERENCES users (steam_id),
  FOREIGN KEY (appid) REFERENCES games (appid)
);