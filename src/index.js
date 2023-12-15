import OpenClient from './api/open.js';
import ShareClient from './api/share.js';

// https://pan.baidu.com/s/1WsmMhDHLyt6e2-oPNv7TvQ?pwd=gty8
// https://pan.baidu.com/s/1EoujkbKqKpEq_Sh8lSUORA?pwd=8m2k
// https://pan.baidu.com/s/1dyL9SnD7ZzjoZMorNLahxw?pwd=ne3g
// https://pan.baidu.com/s/1MHXnM0q3hC07i0IIC7Gjgg?pwd=mx37
// https://pan.baidu.com/disk/main#/index?category=all&path=%2Fapk
// https://pan.baidu.com/wap/home#/dir/%2Fapk
gopeed.events.onResolve(async (ctx) => {
  if (ctx.req.url.includes('pan.baidu.com/disk/main')) {
    const u = new URL(ctx.req.url);
    const pathReg = /path=(.*)/;
    const match = u.hash.match(pathReg);
    if (!match) {
      return;
    }
    const dir = match[1];
    await resolveWithOpen(ctx, dir);
  } else if (ctx.req.url.includes('pan.baidu.com/wap/home')) {
    const u = new URL(ctx.req.url);
    let dir = '/';
    if (u.hash) {
      const pathReg = /dir\/(.*)/;
      const match = u.hash.match(pathReg);
      if (match) {
        dir = match[1];
      }
    }
    await resolveWithOpen(ctx, dir);
  } else if (ctx.req.url.includes('pan.baidu.com/s/')) {
    await resolveWithShare(ctx);
  }
});

/**
 * @type {import('gopeed').EventOnResolve}
 */
async function resolveWithOpen(ctx, dir) {
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
}

/**
 * @type {import('gopeed').EventOnResolve}
 */
async function resolveWithShare(ctx) {
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

gopeed.events.onStart(async (ctx) => {
  await updateDlink(ctx.task);
});

gopeed.events.onError(async (ctx) => {
  await updateDlink(ctx.task);
  // 继续下载
  ctx.task.continue();
});

/**
 * 更新真实下载链接
 * @param {import('gopeed').ExtensionTask} task
 */
async function updateDlink(task) {
  const req = task.meta.req;
  if (!req.labels.gotDlink || task.status == 'error') {
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
}
