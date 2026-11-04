# Педагог сквозь цифру — дашборд Назарчук Т.Н.

```
node server.js                                      # просмотр: http://localhost:8000
$env:ADMIN_TOKEN='ваш-ключ'; node server.js         # + добавление/удаление через кнопку «Добавить достижение»
node test_server.js                                 # проверка валидации и данных
```

- `data/achievements.json` — все достижения (можно править руками).
- `media/` — все дипломы в `media/Заслуги/`, загруженные через форму попадают в `media/Заслуги/uploads/`.
- `public/` — фронтенд (HTML/CSS/JS + Chart.js с CDN). Зависимостей нет, нужен Node.js 18+.


