CREATE DATABASE IF NOT EXISTS mindfulmedia
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
USE mindfulmedia;

CREATE TABLE IF NOT EXISTS users (
  steam_id     VARCHAR(50)      PRIMARY KEY,
  display_name VARCHAR(255)     NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS games (
  appid      BIGINT            PRIMARY KEY,
  title      VARCHAR(255)      NOT NULL,
  image_url  TEXT               NULL,
  category   TEXT               NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_games (
  steam_id  VARCHAR(50)        NOT NULL,
  appid     BIGINT             NOT NULL,
  PRIMARY KEY (steam_id, appid),
  FOREIGN KEY (steam_id) REFERENCES users (steam_id),
  FOREIGN KEY (appid)    REFERENCES games (appid)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
