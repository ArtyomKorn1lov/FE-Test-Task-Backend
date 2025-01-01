const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
require("dotenv").config();

const connection = mysql.createConnection({
    host: process.env.dbHost,
    user: process.env.dbUser,
    port: process.env.dbPort,
    password: process.env.dbPassword,
    database: process.env.dbName
});
connection.connect();

const cors = require('cors');

const app = express();
const port = process.env.serverPort;
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Получить список аккаунтов с пагинацией и с поиском
app.get('/api/accounts/list/', (req, res) => {
    let page = req.query.page;
    let pageCount = req.query.pageCount;
    let order = req.query.order;
    let sort = req.query.sort;
    const searchString = req.query.search;
    const roleCode = req.query.roleCode;
    if (!page || !pageCount) {
        page = 1;
        pageCount = 20; 
    }
    if (!sort || !order) {
        sort = 'sort';
        order = 'ASC'
    }
    if (sort === 'permission') {
        sort = 'r.name';
    } else {
        sort = 'a.' + sort;
    }
    const endLimit = page * pageCount;
    const startLimit = endLimit - pageCount;
    let queryString = `SELECT a.id, a.login, a.email, a.picture, r.name as role, r.code as roleCode FROM accounts as a JOIN role as r ON a.roleId = r.id`;
    (typeof roleCode !== 'undefined') && (queryString = queryString + ` AND r.code = '${roleCode}'`);
    (typeof searchString !== 'undefined') && (queryString = queryString + ` WHERE a.login LIKE '%${searchString}%'`);
    queryString = queryString + ` ORDER BY ${sort} ${order} LIMIT ${startLimit}, ${endLimit};`;
    console.log(queryString);
    connection.query(queryString, [], (err, rows, fields) => {
        if (err) {
            res.send(err);
            throw err;
        }
        res.send(rows);
    });
});

// Получить значения фильтра по умолчанию
app.get('/api/accounts/filter-values/', (req, res) => {
    let queryString = `SELECT code, value FROM filter`;
    connection.query(queryString, [], (err, rows, fields) => {
        if (err) {
            res.send(err);
            throw err;
        }
        res.send(rows);
    });
});

// Получить значения пагинации по умолчанию
app.get('/api/accounts/page-nav/', (req, res) => {
    let queryString = `SELECT code, value FROM pagination`;
    connection.query(queryString, [], (err, rows, fields) => {
        if (err) {
            res.send(err);
            throw err;
        }
        res.send(rows);
    });
});

// Контекстный поиск в поисковой строке
app.get('/api/accounts/search', (req, res) => {
    let queryString = `SELECT a.login FROM accounts as a ORDER BY a.sort ASC LIMIT 50`;
    let search = req.query.search;
    if (!!search) {
        queryString = `SELECT a.login FROM accounts as a WHERE a.login LIKE '%${search}%' ORDER BY a.login ASC LIMIT 50`;
    }
    connection.query(queryString, [], (err, rows, fields) => {
        if (err) {
            res.send(err);
            throw err;
        }
        res.send(rows);
    });
});

app.listen(port, () => {
    console.log(`Приложение доступно по url: http://localhost:${port}/`)
});