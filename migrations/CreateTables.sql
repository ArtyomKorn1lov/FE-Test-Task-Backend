USE fe_task;

CREATE TABLE image (
    id INT PRIMARY KEY AUTO_INCREMENT,
    path TEXT NOT NULL,
);

CREATE TABLE role (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(256) NOT NULL,
    name VARCHAR(256) NOT NULL,
);

CREATE TABLE accounts (
	id INT PRIMARY KEY AUTO_INCREMENT,
    login VARCHAR(256) NOT NULL,
	email VARCHAR(256) NULL,
    sort INT DEFAULT 100,
    picture INT NULL,
    FOREIGN	KEY (picture) REFERENCES image (Id),
    roleId INT NOT NULL,
    FOREIGN KEY (roleId) REFERENCES role (id)
);

CREATE TABLE filter (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(256) NOT NULL,
    value VARCHAR(256) NOT NULL
);