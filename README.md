# Педагог сквозь цифру — дашборд Назарчук Т.Н.

```
node server.js                                      # просмотр: http://localhost:8000
$env:ADMIN_TOKEN='ваш-ключ'; node server.js         # + добавление/удаление через кнопку «Добавить достижение»
node test_server.js                                 # проверка валидации и данных
```

- `docs/data/achievements.json` — все достижения (можно править руками).
- `docs/media/` — все дипломы в `docs/media/Заслуги/`, загруженные через форму попадают в `docs/media/Заслуги/uploads/`.
- `docs/` — фронтенд (HTML/CSS/JS + Chart.js с CDN). Зависимостей нет, нужен Node.js 18+.



Сайт: https://insomn1adevelopment.github.io/dashbordtn/ — GitHub Pages раздаёт папку `docs/` из `main`, обновляется сам после `git push` (только просмотр, без формы добавления).
