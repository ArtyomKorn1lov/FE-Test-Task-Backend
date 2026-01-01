const mysql = require('mysql2');
require("dotenv").config();
const fs = require('fs');
const path = require('path');

const execute = async () => {
    const database_config = {
        host: process.env.dbHost,
        user: process.env.dbUser,
        port: process.env.dbPort,
        password: process.env.dbPassword,
        multipleStatements: true
    };

    let connection = mysql.createConnection(database_config);
    connection.connect();

    // Создание БД
    const createDB_sql = fs.readFileSync(`${__dirname}/migrations/CreateDB.sql`).toString();
    await new Promise((resolve, reject) => {
        connection.query(createDB_sql, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve();
        });
    });

    connection.end();
    connection.destroy();

    connection = mysql.createConnection({
        ...database_config,
        database: process.env.dbName,
    });

    connection.connect();

    let queryStringSettings = `SELECT s.code, s.value FROM settings as s WHERE s.code = 'installed' AND s.value = true;`;
    const isInstalled = await new Promise((resolve, reject) => {
        connection.query(queryStringSettings, [], (err, rows, fields) => {
            if (err) {
                resolve(false);
            }
            if (!!rows && rows.length > 0) {
                resolve(true);
            }
            resolve(false);
        });
    });
    if (isInstalled) {
        console.log('App already installed');
        process.exit();
        return;
    }

    // Создание таблиц
    const createTables_sql = fs.readFileSync(`${__dirname}/migrations/CreateTables.sql`).toString();
    await new Promise((resolve, reject) => {
        connection.query(createTables_sql, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve();
        });
    });

    // Создание папки на сервере
    fs.mkdirSync(`${__dirname}/uploads/files/`, { recursive: true });

    const filterData = JSON.parse(fs.readFileSync(`${__dirname}/migrations/data/filter.json`).toString());
    const paginationData = JSON.parse(fs.readFileSync(`${__dirname}/migrations/data/pagination.json`).toString());
    const rolesData = JSON.parse(fs.readFileSync(`${__dirname}/migrations/data/roles.json`).toString());
    const accountsData = JSON.parse(fs.readFileSync(`${__dirname}/migrations/data/accounts.json`).toString());

    // Элементы таблицы filter
    for (const item of filterData) {
        const queryString = `INSERT INTO filter (code, value) VALUES ('${item.code}', '${item.value}');`;
        await new Promise((resolve, reject) => {
            connection.query(queryString, [], (err, rows, fields) => {
                if (err) {
                    reject(err);
                    throw err;
                }
                resolve();
            });
        });
    }

    // Элементы таблицы pagination
    for (const item of paginationData) {
        const queryString = `INSERT INTO pagination (code, value) VALUES ('${item.code}', '${item.value}');`;
        await new Promise((resolve, reject) => {
            connection.query(queryString, [], (err, rows, fields) => {
                if (err) {
                    reject(err);
                    throw err;
                }
                resolve();
            });
        });
    }

    // Элементы таблицы role
    for (const item of rolesData) {
        const queryString = `INSERT INTO role (code, name) VALUES ('${item.code}', '${item.name}');`;
        await new Promise((resolve, reject) => {
            connection.query(queryString, [], (err, rows, fields) => {
                if (err) {
                    reject(err);
                    throw err;
                }
                resolve();
            });
        });
    }

    // Получить список полей пользователей
    const queryString = `SELECT id, code FROM role`;
    const roles = await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            let roleObject = {};
            rows?.forEach((row) => {
                roleObject[row.code] = row.id;
            });
            resolve(roleObject);
        });
    });

    // Добавление списка аккаунтов
    for (const item of accountsData) {
        let roleId = null;
        for (let key in roles) {
            if (key !== item.role) {
                continue;
            }
            roleId = roles[key];
            break;
        }

        let queryString = `INSERT INTO accounts (login, email, sort, picture, roleId) VALUES ('${item.login}', '${item.email}', ${item.sort}, ${null}, ${roleId});`;
        const accountId = await new Promise((resolve, reject) => {
            connection.query(queryString, [], (err, rows, fields) => {
                if (err) {
                    reject(err);
                    throw err;
                }
                resolve(rows?.insertId);
            });
        });

        if (!item.picture) {
            continue;
        }
        const extentionName = path.extname(item.picture);
        const fileName = `${Date.now()}_${accountId}${extentionName}`;
        const filePath =  `${__dirname}/uploads/files/${fileName}`;
        const readStream = fs.createReadStream(`${__dirname}/migrations/images/${item.picture}`);
        readStream.once('error', (err) => {
            throw err;
        });
        readStream.pipe(fs.createWriteStream(filePath));
        const savedFilePath = "/files/" + fileName;
        queryString = `INSERT INTO image (path) VALUES ('${savedFilePath}');`;
        const imageId = await new Promise((resolve, reject) => {
            connection.query(queryString, [], (err, rows, fields) => {
                if (err) {
                    reject(err);
                    throw err;
                }
                resolve(rows?.insertId);
            });
        });

        queryString = `UPDATE accounts SET picture=${imageId} WHERE id=${accountId};`;
        await new Promise((resolve, reject) => {
            connection.query(queryString, [], (err, rows, fields) => {
                if (err) {
                    reject(err);
                    throw err;
                }
                resolve();
            });
        });
    }

    // Установка флага, что приложение было установлено
    queryStringSettings = `INSERT INTO settings (code, value) VALUES ('installed', true);`;
    await new Promise((resolve, reject) => {
        connection.query(queryStringSettings, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve();
        });
    });

    console.log('App installed successfully');
    process.exit();
}

execute();