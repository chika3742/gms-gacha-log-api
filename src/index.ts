/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
}

const allowedOrigins = [
    "http://localhost:3000",
    "https://gm.chikach.net",
    "https://gms.chikach.net",
]

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const {pathname, searchParams} = new URL(request.url)
    switch (pathname) {
      case "/gachaLog":
        if (request.method === "GET") {
          return cors(request, async (headers) => {
            if (!searchParams.has("authKey")) {
              return jsonResponse({
                errorMessage: "必要なパラメーターが提供されていません"
              }, headers, 400)
            }

            try {
              const result: GachaLogData[] = []
              const gachaTypes = [200, 301, 302]

              for (const wishType of gachaTypes) {
                result.push(...await getGachaLog(searchParams.get("authKey")!, wishType.toString(), searchParams.get(`lastId${wishType}`)))
              }

              return jsonResponse(result, headers)
            } catch (e: any) {
              if (e instanceof GachaLogRequestFailureException) {
                return jsonResponse(e.toJson(), headers, e.statusCode)
              } else {
                console.error(e.toString())
                return jsonResponse({"errorMessage": "500 Internal Server Error"}, headers, 500)
              }
            }
          })
        } else if (request.method === "OPTIONS") {
          return cors(request, (headers) => {
            return new Response(null, {headers})
          })
        } else {
          return new Response("405 Method Not Allowed", {status: 405})
        }
      default:
        return new Response("404 Not Found", {status: 404})
    }
  },
};

function jsonResponse(json: object, headers: HeadersInit, status?: number): Response {
  return new Response(JSON.stringify(json), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  })
}

function cors(request: Request, next: (headers: HeadersInit) => Promise<Response> | Response): Promise<Response> | Response {
  let origin = request.headers.get("Origin");
  if (origin == null || allowedOrigins.includes(origin)) {
    let headers: HeadersInit
    if (origin !== null) {
      headers = {
        'Access-Control-Allow-Origin': origin,
      }
    } else {
      headers = {}
    }
    return next(headers)
  } else {
    return new Response("CORS error")
  }
}

async function getGachaLog(authKey: string, wishType: string, lastId: string | null): Promise<GachaLogData[]> {
  const result: GachaLogData[] = []
  let endLoop = false
  let lastIdTemp: string | undefined = undefined

  while (!endLoop) {
    const list: GachaLogData[] = await sendRequest(authKey, wishType, lastIdTemp)

    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(undefined)
      }, 200)
    })

    if (list.length === 0) {
      break
    }

    for (const item of list) {
      if (!lastId && result.some((e) => e.rankType === "5") && result.some((e) => e.rankType === "4")) {
        endLoop = true
        break
      }
      if (lastId && item.id === lastId) {
        endLoop = true
        break
      }
      result.push(item)
    }

    lastIdTemp = list.splice(-1)[0].id
  }

  return result.reverse()
}

async function sendRequest(authKey: string, wishType: string, lastId?: string): Promise<GachaLogData[]> {
  let url = `https://hk4e-api-os.mihoyo.com/event/gacha_info/api/getGachaLog?authkey=${encodeURIComponent(authKey)}&authkey_ver=1&lang=ja&region=os_asia&game_biz=hk4e_global&size=20&gacha_type=${wishType}`
  if (lastId) {
    url += `&end_id=${lastId}`
  }

  const result = await fetch(new Request(url))

  const data = JSON.parse(await result.text())

  if (data?.data?.list) {
    return (data.data.list as any[]).map(e => ({
      id: e.id,
      gachaType: e.gacha_type,
      name: e.name,
      time: e.time,
      itemType: e.item_type,
      rankType: e.rank_type,
    } as GachaLogData))

  }  else {
    let statusCode: number
    let errorMessage: string

    switch (data.retcode) {
      case -101:
        statusCode = 401
        errorMessage = "ログインキーが時間切れになりました。再度URLをゲーム内で取得し、貼り付けてください。"
        break
      case -100:
        statusCode = 401
        errorMessage = "ログインキーが正しくありません。再度URLをゲーム内で取得し、貼り付けてください。"
        break
      case -110:
        statusCode = 429
        errorMessage = "リクエストが多すぎます。一定の時間をおいて再度お試しください。"
        break
      default:
        statusCode = 500
        errorMessage = "不明なエラーです。"
    }

    throw new GachaLogRequestFailureException(statusCode, errorMessage, data)
  }
}

class GachaLogRequestFailureException {
  constructor(public statusCode: number, public message: string, public error: unknown) {}

  toJson() {
    return {
      errorMessage: this.message,
      error: this.error,
    }
  }
}
