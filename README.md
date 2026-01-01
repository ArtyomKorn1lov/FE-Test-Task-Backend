# Справочник пользователей FeTestTask (backend)

## Справочник пользователей FeTestTask, на момент реализации ТЗ удалено с github

### Краткая информация:

- Простейший backend на node.js, взаимодействие с клиентской частью происходит посредством REST, где все endpoint'ы и функционал описаны в одном файле
- Используется СУБД MySQL >=8.0
- Функционал: базовый CRUD, фильтрация, сортировка, пагинация, загрузка файлов
- Доступно развёртывание в Docker

### Cсылка на репозиторий с frontend - https://github.com/ArtyomKorn1lov/FE-Test-Task-Frontend
### Cсылка на репозиторий с docker compose - https://github.com/ArtyomKorn1lov/FE-Test-Task-Docker-Compose

## Мануальная установка проекта:

### Установка зависимостей

```sh
npm install
```

### Установка приложения, запуск миграций

```sh
npm run install:app
```
#### Или
```sh
sh install.sh
```

### Запуск приложения для разработки

```sh
npm run dev
```

### Запуск приложения в режиме prod

```sh
npm run start
```

## Установка проекта в docker:

### Сборка образа:

```sh
docker build -t fe-test-task-backend .
```

### Запуск контейнера:

```sh
docker run -d -p 8000:80 --name fe-test-task-backend fe-test-task-backend
```