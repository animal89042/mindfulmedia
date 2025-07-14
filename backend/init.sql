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

// async function initSchema() {
//   // connect _without_ database name
//   const initConn = await mysql.createConnection({
//     host: DB_HOST,
//     user: DB_USER,
//     password: DB_PASS,
//     // allow semi-colon separated statements
//     multipleStatements: true,
//   });

//   const ddl = fs.readFileSync(path.resolve(__dirname, "init.sql"), "utf8");
//   await initConn.query(ddl);
//   await initConn.end();

//   console.log("init.sql applied (database + tables created if missing)");
// }

CREATE DATABASE IF NOT EXISTS mindfulmedia;
USE mindfulmedia;

CREATE TABLE IF NOT EXISTS users (
  steam_id      VARCHAR(50) PRIMARY KEY,
  display_name  VARCHAR(255)
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