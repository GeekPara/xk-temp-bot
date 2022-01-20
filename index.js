import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import axios from 'axios'
import { createClient, segment } from 'oicq'
import Koa from "koa"
import bodyParse from "koa-body"
import _ from "lodash"

function zfill(s, n) {
    if (s.length < n) return ' '.repeat(n - s.length) + s
    return s
}
function sleep(t) {
    return new Promise(res => {
        setTimeout(() => res(), t)
    })
}
function showName(t) {
    return t.toString().length === 2 ? t.toString()[0] + '　' + t.toString()[1] : t.toString()
}


if (isMainThread) {
    const account = 2725005108;
    const client = createClient(account);
    const BIND_QQ_API = process.env.BIND_QQ_API || 'http://localhost:3001'
    client.on('system.online', async () => {
        console.log('Logged in!');
    });
    client.on('system.login.qrcode', function (e) {
        process.stdin.once('data', () => {
            this.login();
        });
    }).login();
    client.on('request.friend.add', async function (e) {
        console.log(e)
        const res = await axios.post(BIND_QQ_API.trimEnd('/') + '/apiv2/bind-qq', {
            qq_number: e.user_id,
            token: e.comment
        })
        await e.approve()
        if (res.data.code) {
            await client.sendPrivateMsg(e.user_id, '绑定失败[' + res.data.code.toString() + ']: ' + res.data.msg.toString())
            await client.sendPrivateMsg(e.user_id, '若想重试，请再次发送好友申请。')
            await client.deleteFriend(e.user_id)
        } else {
            await client.sendPrivateMsg(e.user_id, '成功绑定 ' + res.data.name)
            if (await client.inviteFriend(476702599, e.user_id)) {
                await client.sendPrivateMsg(e.user_id, '已邀请您进入推送群(476702599)。注意，若打卡成功仅会在群内公布，只有打卡失败才会通过私聊通知。')
            } else {
                await client.sendPrivateMsg(e.user_id, '请加入推送群(476702599)。注意，若打卡成功仅会在群内公布，只有打卡失败才会通过私聊通知。')
            }
            await client.sendPrivateMsg(e.user_id, '若想暂停打卡或者暂停推送，请前往网页端设置。')
        }
    })
    /*
        [
            {
                "code": 0,
                "temperature": "36.1",
                "msg": "xxx",
                "qq": 1234567891,
                "name": "张三"
            },
            ...
        ]
    */
    async function inform(data) {
        const failed = data.filter(e => e.code)
        if (failed.length) {
            failed.forEach(e => {
                client.sendPrivateMsg(e.qq, '体温录入失败:' + e.msg + '\n请手动录入').catch(() => {
                    console.log(e.name, e.qq, '打卡失败且提醒失败，可能被删除好友。')
                })
            })
        }
        await client.sendGroupMsg(476702599, segment.fromCqcode('[CQ:at,qq=all] 今日体温打卡推送：'))
        const SIZE = 20
        let cur = 1
        const seg = _.chunk(data, SIZE)
        for (let block of seg) {
            let msg = '[' + cur.toString() + ' - ' + (Math.min(cur + SIZE - 1, data.length)).toString() + ']'
            for (let item of block) {
                let line = zfill((cur++).toString(), 3) + '. ' + showName(item.name) + ': '
                if (item.code) line += '失败(' + item.msg + ')'
                else line += '成功(' + item.temperature.toString() + '°C)'
                msg += '\n' + line
            }
            await sleep(1000)
            await client.sendGroupMsg(476702599, segment.fromCqcode(msg))
        }
    }
    const worker = new Worker("./index.js");
    worker.on('message', inform)
} else {
    const koa = new Koa();
    koa.use(bodyParse());
    koa.use(async ctx => {
        parentPort.postMessage(ctx.request.body)
        ctx.response.body = JSON.stringify({
            code: 0
        })
    })
    koa.listen(9000, async () => console.log("HTTP server Started."));
}
