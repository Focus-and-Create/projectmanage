# todo-mcp-server

Claude 앱에서 대화를 통해 투두를 관리하는 MCP 서버입니다.

## 구조

```
Claude 앱 (대화)  ──MCP(stdio)──>  todo-mcp-server  ──>  SQLite DB
                                         │
웹앱 (투두 뷰어)  ──REST API────>        │ (HTTP 모드)
                                         │
iPhone Shortcut   ──/api/widget──>       │
```

## 설치

```bash
cd todo-mcp-server
npm install
npm run build
```

## Claude 앱에 연결하기

### claude_desktop_config.json 설정

Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "todo": {
      "command": "node",
      "args": ["/절대경로/todo-mcp-server/dist/index.js"],
      "env": {
        "DB_PATH": "/절대경로/data/todos.db"
      }
    }
  }
}
```

설정 후 Claude 앱을 재시작하면 투두 관리 도구가 활성화됩니다.

## MCP 도구 목록

| 도구 | 설명 |
|------|------|
| `todo_list` | 투두 목록 조회 (상태 필터 가능) |
| `todo_create` | 새 투두 생성 |
| `todo_modify` | 기존 투두 수정 |
| `todo_delete` | 투두 삭제 |
| `todo_complete` | 투두 완료/미완료 처리 |

## 사용 예시 (Claude 앱에서)

```
사용자: "내일 피그마 디자인 리뷰 해야 해"
Claude: [todo_create 호출] → "투두를 생성했습니다. ID: 1, 제목: 피그마 디자인 리뷰"

사용자: "지금 뭐 해야 돼?"
Claude: [todo_list 호출] → 현재 투두 목록 표시 + 우선순위 분석

사용자: "1번 투두 완료!"
Claude: [todo_complete 호출] → "투두 [1] '피그마 디자인 리뷰'을(를) 완료 처리했습니다."
```

## 웹앱용 HTTP 모드

투두를 브라우저에서도 보고 편집하려면 HTTP 모드로 실행:

```bash
TRANSPORT=http PORT=3001 node dist/index.js
```

REST API:
- `GET /api/todos` — 투두 목록
- `POST /api/todos` — 투두 생성
- `PUT /api/todos/:id` — 투두 수정
- `DELETE /api/todos/:id` — 투두 삭제
- `PATCH /api/todos/:id/status` — 상태 변경
- `GET /api/widget` — 위젯용 요약

## 개발

```bash
npm run dev     # TypeScript 워치 모드
npm test        # 테스트 실행
```
