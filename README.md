# Soul Broker Online

Мультиплеерная браузерная игра на `Next.js + Socket.IO`.

## Что уже сделано

- Безопасный реюз сессии по `reconnectToken` (без угона по нику).
- Обработка `disconnect` с grace-периодом и очисткой игрока из комнаты.
- Очистка и ограничение чата на сервере.
- Убраны блокирующие ошибки ESLint и TypeScript.
- Добавлен тестовый контур (`vitest`) и набор unit-тестов для core-логики.

## Требования

- Node.js 20+ (проверено на 24.x)
- npm 10+

## Установка

```bash
npm install
```

## Запуск разработки

```bash
npm run dev
```

Сервер стартует на:

```text
http://localhost:3000
```

## Проверки качества

```bash
npm run lint
npm test
npm run build
```

## Структура

- `server.ts` — Socket.IO сервер и игровая оркестрация.
- `app/` — Next.js UI.
- `context/SocketContext.tsx` — клиентская транспортная логика.
- `lib/game/core.ts` — чистые функции core-логики.
- `tests/core.test.ts` — unit-тесты core-модуля.
