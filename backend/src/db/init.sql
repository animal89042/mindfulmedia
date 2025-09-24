/* ========================= CORE TABLES ========================== */

/* App users */
CREATE TABLE IF NOT EXISTS users (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    username    VARCHAR(255) NOT NULL,
    avatar      VARCHAR(512) NULL,
    profile_url VARCHAR(512) NULL,
    role        ENUM('user','admin') NOT NULL DEFAULT 'user',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username)
);

/* One row per connected platform account (Steam today, multi-platform ready) */
CREATE TABLE IF NOT EXISTS user_identities (
    id                BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id           BIGINT NOT NULL,
    platform          ENUM('steam','xbox','playstation','nintendo') NOT NULL,
    platform_user_id  VARCHAR(64) NOT NULL,
    gamertag          VARCHAR(255) NULL,
    avatar_url        VARCHAR(512) NULL,
    linked_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ui_platform_user (platform, platform_user_id),
    KEY ix_ui_user (user_id),
    CONSTRAINT fk_ui_user
        FOREIGN KEY (user_id) REFERENCES users(id)
);

/* Per-platform game catalog entry (appid for Steam, etc.) */
CREATE TABLE IF NOT EXISTS platform_games (
    id                 BIGINT PRIMARY KEY AUTO_INCREMENT,
    platform           ENUM('steam','xbox','playstation','nintendo') NOT NULL,
    platform_game_id   VARCHAR(64) NOT NULL,
    name               VARCHAR(255) NULL,
    icon_url           VARCHAR(512) NULL,
    last_seen          TIMESTAMP NULL,
    UNIQUE KEY uq_pg_platform_game (platform, platform_game_id),
    KEY ix_pg_platform (platform)   -- helpful for join filters
);

/* What a given identity owns/plays */
CREATE TABLE IF NOT EXISTS user_game_library (
    id                BIGINT PRIMARY KEY AUTO_INCREMENT,
    identity_id       BIGINT NOT NULL,
    platform_game_id  BIGINT NOT NULL,
    playtime_minutes  INT NOT NULL DEFAULT 0,
    last_played_at    TIMESTAMP NULL,
    last_refreshed    TIMESTAMP NULL,
    UNIQUE KEY uq_ugl_identity_game (identity_id, platform_game_id),
    CONSTRAINT fk_ugl_identity
        FOREIGN KEY (identity_id)      REFERENCES user_identities(id),
    CONSTRAINT fk_ugl_game
        FOREIGN KEY (platform_game_id) REFERENCES platform_games(id)
);

/* per-game rollups */
CREATE TABLE IF NOT EXISTS user_game_stats (
    id                BIGINT PRIMARY KEY AUTO_INCREMENT,
    identity_id       BIGINT NOT NULL,
    platform_game_id  BIGINT NOT NULL,
    metric            VARCHAR(64) NOT NULL,
    value             BIGINT NULL,
    captured_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ugs_identity_game_metric (identity_id, platform_game_id, metric),
    CONSTRAINT fk_ugs_identity
        FOREIGN KEY (identity_id)      REFERENCES user_identities(id),
    CONSTRAINT fk_ugs_game
        FOREIGN KEY (platform_game_id) REFERENCES platform_games(id)
);

/* Per-game achievements */
CREATE TABLE IF NOT EXISTS user_game_achievements (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    identity_id         BIGINT NOT NULL,
    platform_game_id    BIGINT NOT NULL,
    achievement_api_name VARCHAR(128) NOT NULL,
    unlocked_at         TIMESTAMP NULL,
    progress            INT NULL DEFAULT 0,
    UNIQUE KEY uq_uga_identity_game_ach (identity_id, platform_game_id, achievement_api_name),
    KEY ix_uga_identity (identity_id),
    KEY ix_uga_game (platform_game_id),
    CONSTRAINT fk_uga_identity
        FOREIGN KEY (identity_id)      REFERENCES user_identities(id),
    CONSTRAINT fk_uga_game
        FOREIGN KEY (platform_game_id) REFERENCES platform_games(id)
);

/* Achievements: global rarity snapshots */
CREATE TABLE IF NOT EXISTS game_achievement_global (
    id                   BIGINT PRIMARY KEY AUTO_INCREMENT,
    platform             ENUM('steam','xbox','playstation','nintendo') NOT NULL,
    platform_game_id     VARCHAR(64) NOT NULL,
    achievement_api_name VARCHAR(128) NOT NULL,
    percent              DECIMAL(6,3) NULL,
    captured_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_gag_lookup (platform, platform_game_id, achievement_api_name, captured_at)
);

/* Ingestion snapshots */
CREATE TABLE IF NOT EXISTS ingestion_snapshots (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    identity_id  BIGINT NOT NULL,
    platform     ENUM('steam','xbox','playstation','nintendo') NOT NULL,
    source       VARCHAR(64) NULL,
    taken_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload      JSON NULL,
    KEY ix_snap_identity_taken (identity_id, taken_at),
    CONSTRAINT fk_snap_identity
        FOREIGN KEY (identity_id) REFERENCES user_identities(id)
);


/* User Journals */
CREATE TABLE IF NOT EXISTS user_game_journals (
    id                BIGINT PRIMARY KEY AUTO_INCREMENT,
    identity_id       BIGINT NOT NULL,
    platform_game_id  BIGINT NOT NULL,
    title             VARCHAR(255) NOT NULL DEFAULT '',
    entry             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at         TIMESTAMP NULL,
    KEY ix_uj_identity_game_created (identity_id, platform_game_id, created_at),
    CONSTRAINT fk_uj_identity
        FOREIGN KEY (identity_id)      REFERENCES user_identities(id),
    CONSTRAINT fk_uj_game
        FOREIGN KEY (platform_game_id) REFERENCES platform_games(id)
);

/* Friendships */
CREATE TABLE IF NOT EXISTS friendships (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_a_id BIGINT NOT NULL,
    user_b_id BIGINT NOT NULL,
    status ENUM('pending','accepted','declined','blocked') NOT NULL DEFAULT 'pending',
    requested_by BIGINT NOT NULL,
    responded_by BIGINT NULL,
    blocked_by BIGINT NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_ordered_pair CHECK (user_a_id <= user_b_id),
    CONSTRAINT uq_pair UNIQUE (user_a_id, user_b_id),
    INDEX idx_user_a (user_a_id),
    INDEX idx_user_b (user_b_id),
    INDEX idx_status (status),
    CONSTRAINT fk_friends_user_a FOREIGN KEY (user_a_id) REFERENCES users(id),
    CONSTRAINT fk_friends_user_b FOREIGN KEY (user_b_id) REFERENCES users(id)
);
/* ========================= CONVENIENCE ========================== */

/* Library view your routes already use */
CREATE OR REPLACE VIEW v_identity_library AS
SELECT
    ugl.identity_id,
    pg.platform,
    pg.platform_game_id AS game_id,
    COALESCE(pg.name, '') AS game_name,
    pg.icon_url,
    ugl.playtime_minutes,
    ugl.last_played_at,
    ugl.last_refreshed
FROM user_game_library AS ugl
         JOIN platform_games AS pg
              ON pg.id = ugl.platform_game_id;

/* View used by /api/friends to list accepted friends */
CREATE OR REPLACE VIEW v_user_friends AS
SELECT user_a_id AS user_id, user_b_id AS friend_id
FROM friendships
WHERE status = 'accepted'
UNION ALL
SELECT user_b_id AS user_id, user_a_id AS friend_id
FROM friendships
WHERE status = 'accepted';

/* Progress view: unlocked/total per identity+game */
DROP VIEW IF EXISTS v_identity_achievement_progress;
CREATE VIEW v_identity_achievement_progress AS
SELECT ugl.identity_id,
       pg.platform,
       pg.platform_game_id                                                       AS game_id,
       COUNT(DISTINCT gac.achievement_api_name)                                  AS total_achievements,
       COALESCE(SUM(CASE WHEN uga.unlocked_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS unlocked_achievements
FROM user_game_library AS ugl
         JOIN platform_games AS pg
              ON pg.id = ugl.platform_game_id
         LEFT JOIN game_achievement_catalog AS gac
                   ON gac.platform = pg.platform
                       AND gac.platform_game_id = pg.platform_game_id
         LEFT JOIN user_game_achievements AS uga
                   ON uga.identity_id = ugl.identity_id
                       AND uga.platform_game_id = ugl.platform_game_id
                       AND uga.achievement_api_name = gac.achievement_api_name
GROUP BY ugl.identity_id, pg.platform, pg.platform_game_id;