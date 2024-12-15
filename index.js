const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');

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

app.get('/api/accounts/list/', (req, res) => {
    res.send('Тестовые данные!');
});

app.listen(port, () => {
    console.log(`Приложение доступно по порту: ${port}`)
  });