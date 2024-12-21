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
    let queryString = `SELECT a.id, a.login, a.email, a.picture, r.name as role, r.code as roleCode FROM accounts as a LEFT JOIN role as r ON a.roleId = r.id`;
    (typeof searchString !== 'undefined') && (queryString = queryString + ` WHERE a.login LIKE '%${searchString}%' OR a.email LIKE '%${searchString}%'`);
    queryString = queryString + ` ORDER BY ${sort} ${order} LIMIT ${startLimit}, ${endLimit};`;
    console.log('final request:', queryString);
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