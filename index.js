const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
require("dotenv").config();
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');

const connection = mysql.createConnection({
    host: process.env.dbHost,
    user: process.env.dbUser,
    port: process.env.dbPort,
    password: process.env.dbPassword,
    database: process.env.dbName,
    multipleStatements: true
});
connection.connect();

const cors = require('cors');

const app = express();
const port = process.env.serverPort;
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload({
    limits: { fileSize: 2 * 1024 * 1024 }
  }));
app.use(express.static('uploads'));

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
    const startLimit = page * pageCount - pageCount;
    let queryString = `SELECT a.id, a.login, a.email, i.path as picture, r.name as role, r.code as roleCode FROM accounts as a LEFT JOIN image as i ON a.picture = i.id JOIN role as r ON a.roleId = r.id`;
    (typeof roleCode !== 'undefined') && (queryString = queryString + ` AND r.code = '${roleCode}'`);
    (typeof searchString !== 'undefined') && (queryString = queryString + ` WHERE a.login LIKE '%${searchString}%'`);
    queryString = queryString + ` ORDER BY ${sort} ${order} LIMIT ${startLimit}, ${pageCount};`;
    connection.query(queryString, [], (err, rows, fields) => {
        if (err) {
            res.send(err);
            throw err;
        }
        rows = rows.map((item) => {
            (!!item.picture) && (item.picture = getImageUrl(req, item.picture));
            return item;
        });
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

// Получить список всех ролей пользователей
app.get('/api/accounts/roles/', (req, res) => {
    let queryString = `SELECT id, code, name FROM role`;
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
    const search = req.query.search;
    const roleCode = req.query.roleCode;
    let queryString = `SELECT a.login FROM accounts as a`;
    if (!!roleCode) {
        queryString = queryString + ` JOIN role as r ON a.roleId = r.id AND r.code = '${roleCode}'`;
    }
    if (!!search) {
        queryString = queryString + ` WHERE a.login LIKE '%${search}%'`;
    }
    queryString = queryString + ` ORDER BY a.login ASC LIMIT 50`;
    connection.query(queryString, [], (err, rows, fields) => {
        if (err) {
            res.send(err);
            throw err;
        }
        res.send(rows);
    });
});

// Валидация загруженного файла
app.post('/api/accounts/upload', (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).send('No file were uploaded');
    }
    const uploadedFile = req.files.file;
    if (uploadedFile.size === 0) {
        return res.status(400).send('Uploaded file is empty');
    }
    const extentionName = path.extname(uploadedFile.name);
    if (!fileExtentions.includes(extentionName)) {
        return res.status(400).send('Incorrectly uploaded file');
    }
    return res.send('File was uploaded');
});

// Создать новый аккаунт
app.post('/api/accounts/create/', async (req, res) => {
    let createAccountModel = req.body;
    if (!!createAccountModel.picture?.file) {
        await saveImage(createAccountModel.picture?.file, createAccountModel.picture?.name)
            .then((result) => {
                createAccountModel.picture = result;
            })
            .catch((error) => {
                return res.status(400).send(error);
            })
    }
    let queryString = `INSERT INTO image (path) VALUES ('${createAccountModel.picture}');`;
    let imageId = null;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve(rows?.insertId);
        });
    })
        .then((result) => {
            imageId = result;
        })
        .catch((error) => {
            res.status(400).send(error);
        });
    let maxSortValue = 100;
    queryString = `SELECT sort FROM accounts ORDER BY sort DESC LIMIT 1;`;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve(rows[0]?.sort);
        });
    })
        .then((result) => {
            maxSortValue = result + 1;
        })
    queryString = `INSERT INTO accounts (login, email, sort, picture, roleId) VALUES ('${createAccountModel.login}', '${createAccountModel.email}', ${maxSortValue}, ${imageId}, ${createAccountModel.role});`;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve('Account is created on server');
        });
    })
        .then((result) => {
            res.send(result);
        })
        .catch((error) => {
            res.status(400).send(error);
        });
});

// Удалить аккаунт
app.delete('/api/accounts/delete/:id', async (req, res) => {
    const id = req.params.id;
    let queryString = `SELECT a.picture, i.path FROM accounts as a LEFT JOIN image as i ON a.picture = i.id WHERE a.id=${id};`;
    let fileId = null;
    let filePath = null;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve({
                fileId: rows[0]?.picture,
                path: rows[0]?.path
            });
        });
    })
        .then((result) => {
            fileId = result?.fileId;
            filePath = result?.path
        })
        .catch((error) => {
            res.status(400).send(error);
        });
    queryString = `DELETE FROM accounts WHERE id=${id};`;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve(true);
        });
    })
        .catch((error) => {
            res.status(400).send(error);
        });
    if (!!fileId) {
        await removeImage(res, fileId, filePath);
    } else {
        res.send('Account successfully deleted');
    }
});

const getImageUrl = (req, publicFilePath) => {
    return req.protocol + "://" + req.get('host') + publicFilePath;
} 

const fileExtentions = ['.webp', '.jpg', '.png'];

// Удалить картинку из БД и файловой системы
const removeImage = async (res, fileId, filePath) => {
    let successDeleteImageDatabase = false;
    const queryString = `DELETE FROM image WHERE id=${fileId};`;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve(true);
        });
    })
        .then((result) => {
            successDeleteImageDatabase = result;
        })
        .catch((error) => {
            res.status(400).send(error);
        });
    (!!successDeleteImageDatabase)
        && await deleteImage(filePath)
            .then((response) => {
                !!response && res.send('Account successfully deleted');
            })
            .catch((error) => {
                res.status(400).send(error);
            });
}

const saveImage = (fileBase64, nameFile) => {
    return new Promise((resolve, reject) => {
        const uploadedFile = fileBase64;
        if (uploadedFile === null) {
            reject('Uploaded file is empty');
        }
        const extentionName = path.extname(nameFile);
        if (!fileExtentions.includes(extentionName)) {
            reject('Incorrectly uploaded file');
        }
        const fileName = Date.now() + extentionName;
        const folderName = __dirname + "/uploads/files/";
        fs.writeFile(path.join(folderName, fileName), uploadedFile, { encoding: 'base64' }, async (err) => {
            if (err) {
                reject('Error saving file');
            }
            const savedFilePath = "/files/" + fileName;
            resolve(savedFilePath);
        });
    });
}

const deleteImage = (filePath) => {
    return new Promise((resolve, reject) => {
        const folderName = __dirname + "/uploads/";
        fs.unlink(path.join(folderName, filePath), async (err) => {
            if (err) {
                reject('Error delete file');
            }
            resolve(true);
        });
    });
}

app.listen(port, () => {
    console.log(`Приложение доступно по url: http://localhost:${port}/`)
});