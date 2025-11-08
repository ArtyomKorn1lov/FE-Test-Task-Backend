const express = require('express');
const mysql = require('mysql2');
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

// Доступные для загрузки расширения файлов
const fileExtentions = ['.webp', '.jpg', '.png'];

// Получить список аккаунтов по фильтру, с пагинацией
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
        order = 'ASC';
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
    const imageId = await saveAccountImage(createAccountModel, res);
    const maxSortValue = await getMaxSortValue();
    const queryString = `INSERT INTO accounts (login, email, sort, picture, roleId) VALUES ('${createAccountModel.login}', '${createAccountModel.email}', ${maxSortValue}, ${imageId}, ${createAccountModel.role});`;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve('Account is successfuly created on server');
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
    await deleteAccounts([id], res);
});

// Удалить несколько аккаунтов
app.post('/api/accounts/delete/', async (req, res) => {
    const accountsDeleteModel = req.body.ids;
    await deleteAccounts(accountsDeleteModel, res);
});

// Получить аккаунт по его id
app.get('/api/accounts/:id', async (req, res) => {
    const id = req.params.id;
    const queryString = `SELECT a.id, a.login, a.email, a.roleId as role, i.id as imageId, i.path as imagePath FROM accounts as a LEFT JOIN image as i ON a.picture = i.id WHERE a.id = ${id};`;
    connection.query(queryString, [], (err, rows, fields) => {
        if (err) {
            res.send(err);
            throw err;
        }
        if (!rows || rows.length <= 0) {
            return {};
        }
        let accountEditModel = rows[0];
        const imageUrl = !!accountEditModel.imagePath ? getImageUrl(req, accountEditModel.imagePath) : null;
        accountEditModel = {
            id: accountEditModel.id,
            login: accountEditModel.login,
            email: accountEditModel.email,
            picture: {
                id: accountEditModel.imageId,
                url: imageUrl,
                file: null,
                name: ''
            },
            role: accountEditModel.role
        };
        res.send(accountEditModel);
    });
});

// Редактирование аккаунта
app.put('/api/accounts/edit/', async (req, res) => {
    let editAccountModel = req.body;
    let imageId = null;
    !editAccountModel.picture?.id 
        ? (imageId = await updateImage(editAccountModel, res))
        : (imageId = editAccountModel.picture?.id);
    const queryString = `UPDATE accounts SET login='${editAccountModel.login}', email='${editAccountModel.email}', picture=${imageId}, roleId=${editAccountModel.role} WHERE id=${editAccountModel.id};`;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve('Account is successfuly updated on server');
        });
    })
        .then((result) => {
            res.send(result);
        })
        .catch((error) => {
            res.status(400).send(error);
        });
});

// Получить url изображения на сервере
const getImageUrl = (req, publicFilePath) => {
    return req.protocol + "://" + req.get('host') + publicFilePath;
} 

// Сохранить изображение в таблицу и в файловую систему
const saveAccountImage = async (createAccountModel, res) => {
    const pictureFile = createAccountModel.picture?.file;
    if (!!pictureFile) {
        await saveImage(pictureFile, createAccountModel.picture?.name)
            .then((result) => {
                createAccountModel.picture = result;
            })
            .catch((error) => {
                return res.status(400).send(error);
            })
    }
    let imageId = null;
    if (!!pictureFile) {
        const queryString = `INSERT INTO image (path) VALUES ('${createAccountModel.picture}');`;
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
    }
    return imageId;
}

// Сохранить изображение в файловую систему
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

// Получить максимальное значение поля sort
const getMaxSortValue = async () => {
    let maxSortValue = 100;
    const queryString = `SELECT sort FROM accounts ORDER BY sort DESC LIMIT 1;`;
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
            !!result && (maxSortValue = result + 1);
        });
    return maxSortValue;
}

// Удаление аккаунта из БД и привязанного файла из файловой системы
const deleteAccounts = async (arIds, res) => {
    const strIds = arIds.toString();
    let queryString = `SELECT a.picture, i.path FROM accounts as a LEFT JOIN image as i ON a.picture = i.id WHERE a.id IN (${strIds});`;
    let arFileIds = [];
    let arFilesPath = [];
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve(rows);
        });
    })
        .then((result) => {
            result?.forEach((item) => {
                if (!item.picture || !item.path) {
                    return;
                }
                arFileIds.push(item.picture);
                arFilesPath.push(item.path);
            });
        })
        .catch((error) => {
            res.status(400).send(error);
        });
    queryString = `DELETE FROM accounts WHERE id IN (${strIds});`;
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
    if (!!arFileIds && arFileIds.length > 0) {
        const isSuccessDelete = await removeImage(res, arFileIds, arFilesPath); 
        !!isSuccessDelete
            ? res.send('Account successfully deleted')
            : res.status(400).send('Error delete account image');
    } else {
        res.send('Account successfully deleted');
    }
}

// Удалить картинку из БД и файловой системы
const removeImage = async (res, arFileIds, arFilesPath) => {
    let strIds = [];
    arFileIds.forEach((item) => {
        !!item && (strIds.push(item));
    });
    strIds = strIds.toString();
    let successDeleteImageDatabase = false;
    const queryString = `DELETE FROM image WHERE id IN (${strIds});`;
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
    if (!!successDeleteImageDatabase) {
        let isSuccessDelete = false;
        await new Promise((resolve, reject) => {
            arFilesPath.forEach(async (item) => {
                await deleteImage(item)
                    .then((response) => {
                        resolve(response);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        })
            .then((result) => {
                isSuccessDelete = result;
            })
            .catch((error) => {
                res.status(400).send(error);
            });
        return isSuccessDelete;
    }
    return false;
}

// Удалить картинку из файловой системы
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

// Обновить загруженную картинку
const updateImage = async (editAccountModel, res) => {
    let pictureId = null;
    let picturePath = null;
    let queryString = `SELECT a.picture, i.path FROM accounts as a LEFT JOIN image as i ON a.picture = i.id WHERE a.id=${editAccountModel.id};`;
    await new Promise((resolve, reject) => {
        connection.query(queryString, [], (err, rows, fields) => {
            if (err) {
                reject(err);
                throw err;
            }
            resolve(rows);
        });
    })
        .then((result) => {
            pictureId = result[0]?.picture;
            picturePath = result[0]?.path;
        })
        .catch((error) => {
            res.status(400).send(error);
        });
    queryString = `UPDATE accounts SET picture=${null} WHERE id=${editAccountModel.id};`;
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
    if (!!pictureId && !!picturePath) {
        const isSuccessDelete = await removeImage(res, [pictureId], [picturePath]);
        !isSuccessDelete && res.status(400).send('Error delete account image');
    }
    return await saveAccountImage(editAccountModel, res);
}

app.listen(port, () => {
    console.log(`The application is available at the following port: ${port}`)
});