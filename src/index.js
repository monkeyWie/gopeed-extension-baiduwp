import gopeed from 'gopeed';
import Client from './api/share.js';

// https://pan.baidu.com/s/1WsmMhDHLyt6e2-oPNv7TvQ?pwd=gty8
// https://pan.baidu.com/s/1EoujkbKqKpEq_Sh8lSUORA?pwd=8m2k
// https://pan.baidu.com/s/1dyL9SnD7ZzjoZMorNLahxw?pwd=ne3g
// https://pan.baidu.com/s/1MHXnM0q3hC07i0IIC7Gjgg?pwd=mx37
gopeed.events.onResolve(async (ctx) => {
  const u = new URL(ctx.req.url);
  const surl = u.pathname.split('/')[2];
  const search = u.search;
  let pwd = '';
  if (search) {
    const pwdList = search
      .replace('?', '')
      .split('&')
      .filter((item) => {
        const [key, value] = item.split('=');
        if (key === 'pwd') {
          return value;
        }
      });
    if (pwdList.length > 0) {
      pwd = pwdList[0];
    }
  }
  gopeed.logger.debug('match', surl, pwd);
  if (!surl) {
    return;
  }

  const client = new Client(surl, pwd, gopeed.settings.bduss);

  const shareInfo = await client.getShareInfo();
  const name = shareInfo.title.split('/').pop() + (shareInfo.list.length > 1 ? '等' : '');
  const parentDir = shareInfo.title.split('/').slice(0, -1).join('/') + '/';
  const fileList = await client.getFileList();

  ctx.res = {
    name,
    files: fileList.map((item) => ({
      name: item.server_filename,
      size: item.size,
      path: item.path.replace(parentDir, '').split('/').slice(0, -1).join('/'),
      req: {
        url: item.dlink,
        extra: {
          header: {
            'User-Agent': 'pan.baidu.com',
          },
        },
        labels: {
          [gopeed.info.identity]: '1',
          rawUrl: ctx.req.url,
          surl: surl,
          pwd: pwd,
          fid: item.fs_id,
        },
      },
    })),
  };
});

gopeed.events.onStart(async (ctx) => {
  // 判断是否需要解析直链
  const req = ctx.task.meta.req;
  if (!req.labels.gotDlink || ctx.task.status == 'error') {
    const fid = req.labels.fid;
    const surl = req.labels.surl;
    const pwd = req.labels.pwd;
    const client = new Client(surl, pwd, gopeed.settings.bduss);
    const dlink = await client.getDlink(fid);
    gopeed.logger.info('dlink', dlink);
    req.url = dlink;
    req.labels.gotDlink = '1';
  }
});
