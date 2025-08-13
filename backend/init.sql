/* =========================
   LEGACY TABLES
   ========================= */

CREATE TABLE IF NOT EXISTS users
(
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    username    VARCHAR(255) NOT NULL UNIQUE,
    avatar      TEXT,
    profile_url TEXT,
    role        ENUM ('user','admin') DEFAULT 'user',
    created_at  TIMESTAMP             DEFAULT CURRENT_TIMESTAMP
);

-- LEGACY games: only used for joins in the journal UI
CREATE TABLE IF NOT EXISTS games
(
    id        BIGINT PRIMARY KEY AUTO_INCREMENT,
    appid     VARCHAR(32) UNIQUE,
    title     VARCHAR(255),
    image_url TEXT
);

CREATE TABLE IF NOT EXISTS user_games
(
    steam_id VARCHAR(64) NOT NULL,
    appid    VARCHAR(32) NOT NULL,
    playtime INT DEFAULT 0,
    PRIMARY KEY (steam_id, appid)
);

-- LEGACY journals: fields the app reads/writes
CREATE TABLE IF NOT EXISTS journals
(
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    steam_id   VARCHAR(64) NOT NULL,
    appid      VARCHAR(32) NOT NULL,
    entry      TEXT,
    title      VARCHAR(255) DEFAULT '',
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    edited_at  TIMESTAMP   NULL
);

/* =========================
   MULTI-PLATFORM TABLES
   ========================= */

CREATE TABLE IF NOT EXISTS user_identities
(
    id               BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id          BIGINT                NOT NULL,
    platform         ENUM ('steam','xbox') NOT NULL,
    platform_user_id VARCHAR(64)           NOT NULL,
    gamertag         VARCHAR(255),
    avatar_url       TEXT,
    linked_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uniq_platform_identity (platform, platform_user_id),
    KEY idx_user (user_id)
);

CREATE TABLE IF NOT EXISTS platform_games
(
    id               BIGINT PRIMARY KEY AUTO_INCREMENT,
    platform         ENUM ('steam','xbox') NOT NULL,
    platform_game_id VARCHAR(64)           NOT NULL,
    name             VARCHAR(255),
    icon_url         TEXT,
    last_seen        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uniq_platform_game (platform, platform_game_id),
    KEY idx_platform_name (platform, name)
);

CREATE TABLE IF NOT EXISTS user_game_library
(
    identity_id      BIGINT    NOT NULL,
    platform_game_id BIGINT    NOT NULL,
    playtime_minutes INT       DEFAULT 0,
    last_played_at   DATETIME  NULL,
    first_seen       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_refreshed   TIMESTAMP NULL,

    PRIMARY KEY (identity_id, platform_game_id),
    KEY idx_platform_game (platform_game_id)
);

CREATE TABLE IF NOT EXISTS user_game_stats
(
    identity_id      BIGINT       NOT NULL,
    platform_game_id BIGINT       NOT NULL,
    stat_name        VARCHAR(128) NOT NULL,
    stat_value       DOUBLE       NOT NULL,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (identity_id, platform_game_id, stat_name),
    KEY idx_stats_updated (updated_at)
);

CREATE TABLE IF NOT EXISTS user_game_achievements
(
    identity_id      BIGINT       NOT NULL,
    platform_game_id BIGINT       NOT NULL,
    achievement_id   VARCHAR(128) NOT NULL,
    name             VARCHAR(255) NULL,
    description      TEXT         NULL,
    unlocked         TINYINT(1)   NOT NULL DEFAULT 0,
    unlock_time      DATETIME     NULL,
    updated_at       TIMESTAMP             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (identity_id, platform_game_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS ingestion_snapshots
(
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    identity_id BIGINT                NOT NULL,
    platform    ENUM ('steam','xbox') NOT NULL,
    resource    VARCHAR(64)           NOT NULL,
    payload     JSON                  NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    KEY idx_ingestion_identity_created (identity_id, created_at)
);

/* =========================
   VIEWS (optional)
   ========================= */

/* TiDB-safe way: drop then create */
DROP VIEW IF EXISTS v_identity_library;

CREATE VIEW v_identity_library AS
SELECT ugl.identity_id,
       pg.platform,
       pg.platform_game_id                                    AS game_id,
       COALESCE(pg.name, CONCAT('App ', pg.platform_game_id)) AS game_name,
       pg.icon_url,
       ugl.playtime_minutes,
       ugl.last_played_at,
       ugl.last_refreshed
FROM user_game_library AS ugl
         JOIN platform_games AS pg
              ON pg.id = ugl.platform_game_id;

/* =========================
   INDEXES (TiDB style)
   ========================= */

/* Use ALTER TABLE ... ADD INDEX IF NOT EXISTS (supported by TiDB) */
ALTER TABLE user_game_library
    ADD INDEX IF NOT EXISTS idx_ugl_identity_refreshed (identity_id, last_refreshed);

ALTER TABLE user_game_stats
    ADD INDEX IF NOT EXISTS idx_stats_identity_game (identity_id, platform_game_id);
