import gopeed from 'gopeed';
import OpenClient from './api/open.js';
import ShareClient from './api/share.js';

// https://pan.baidu.com/s/1WsmMhDHLyt6e2-oPNv7TvQ?pwd=gty8
// https://pan.baidu.com/s/1EoujkbKqKpEq_Sh8lSUORA?pwd=8m2k
// https://pan.baidu.com/s/1dyL9SnD7ZzjoZMorNLahxw?pwd=ne3g
// https://pan.baidu.com/s/1MHXnM0q3hC07i0IIC7Gjgg?pwd=mx37
gopeed.events.onResolve(async (ctx) => {
  if (ctx.req.url.includes('pan.baidu.com/disk/main')) {
    const u = new URL(ctx.req.url);
    const pathReg = /path=(.*)/;
    const match = u.hash.match(pathReg);
    if (!match) {
      return;
    }
    const dir = match[1];
    const name = decodeURIComponent(dir).split('/').pop() || '全部文件';

    const openClient = new OpenClient(
      gopeed.settings.clientId,
      gopeed.settings.clientSecret,
      gopeed.settings.refreshToken
    );
    const fileList = await openClient.getFileList(dir);

    gopeed.logger.debug('fileList', JSON.stringify(fileList));

    ctx.res = {
      name,
      files: fileList.map((item) => ({
        name: item.server_filename,
        size: item.size,
        path: decodeURIComponent(item.path.replace(dir, '')).split('/').slice(1, -1).join('/'),
        req: {
          url: `http://d.pcs.baidu.com/file/${item.fs_id}`, // 随便生成一个无效的下载链接，在 onStart 回调里去获取真实下载链接
          extra: {
            header: {
              'User-Agent': 'pan.baidu.com',
            },
          },
          labels: {
            [gopeed.info.identity]: '1',
            fid: item.fs_id,
            notShare: '1',
          },
        },
      })),
    };
  } else if (ctx.req.url.includes('pan.baidu.com/s/')) {
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

    const shareClient = new ShareClient(surl, pwd, gopeed.settings.bduss);

    const shareInfo = await shareClient.getShareInfo();
    const name = shareInfo.title.split('/').pop() + (shareInfo.list.length > 1 ? '等' : '');
    const parentDir = shareInfo.title.split('/').slice(0, -1).join('/') + '/';
    const fileList = await shareClient.getFileList();

    gopeed.logger.debug('fileList', JSON.stringify(fileList));

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
  }
});

gopeed.events.onStart(async (ctx) => {
  // 判断是否需要解析直链
  const req = ctx.task.meta.req;
  if (!req.labels.gotDlink || ctx.task.status == 'error') {
    const fid = req.labels.fid;
    var dlink = req.url;
    if (req.labels.notShare) {
      const openClient = new OpenClient(
        gopeed.settings.clientId,
        gopeed.settings.clientSecret,
        gopeed.settings.refreshToken
      );
      dlink = await openClient.getDlink(fid);
    } else {
      const surl = req.labels.surl;
      const pwd = req.labels.pwd;
      const shareClient = new ShareClient(surl, pwd, gopeed.settings.bduss);
      dlink = await shareClient.getDlink(fid);
    }

    gopeed.logger.info('dlink', dlink);
    req.url = dlink;
    req.labels.gotDlink = '1';
  }
});
