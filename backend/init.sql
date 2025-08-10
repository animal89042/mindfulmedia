-- users
CREATE TABLE IF NOT EXISTS users (
    steam_id     VARCHAR(50) NOT NULL PRIMARY KEY,
    display_name VARCHAR(255),
    persona_name VARCHAR(255),
    avatar       VARCHAR(512),
    profile_url  VARCHAR(512),
    role         VARCHAR(16) DEFAULT 'user',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- games
CREATE TABLE IF NOT EXISTS games (
    appid     BIGINT NOT NULL PRIMARY KEY,
    title     VARCHAR(255),
    image_url VARCHAR(512),
    category  VARCHAR(64)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- user_games (no FKs)
CREATE TABLE IF NOT EXISTS user_games (
    steam_id VARCHAR(50) NOT NULL,
    appid    BIGINT NOT NULL,
    PRIMARY KEY (steam_id, appid)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- journals
CREATE TABLE IF NOT EXISTS journals (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    steam_id   VARCHAR(50),
    appid      BIGINT,
    entry      TEXT,
    title      VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at  DATETIME NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
