const API_URL = 'https://pan.baidu.com/api';

class Client {
  constructor(appId, ua, cookie) {
    this.appId = appId || 250528;
    this.headers = {
      'User-Agent':
        ua ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Edg/117.0.2045.60',
      Cookie: cookie,
      Referer: 'https://pan.baidu.com/disk/main',
      'X-Requested-With': 'XMLHttpRequest',
    };
    // 随机生成一个logid，长度20位的数字，作为初始化的logid
    this.logid = Math.random().toString().slice(2, 12) + Math.random().toString().slice(2, 12);
  }

  async list(dir) {
    const resp = await fetch(
      `${API_URL}/list?clienttype=0&app_id=${this.appId}&web=1&dp-logid=${this
        .logid++}&order=name&desc=1&dir=${dir}&num=100&page=1`,
      {
        headers: this.headers,
      }
    );
    return await resp.json();
  }

  async getAccessToken(refreshToken) {
    const resp = await fetch(
      `https://openapi.baidu.com/oauth/2.0/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=iYCeC9g08h5vuP9UqvPHKKSVrKFXGa1v&client_secret=jXiFMOPVPCWlO2M5CwWQzffpNPaGTRBG`
    );
    const data = await resp.json();
    return data.access_token;
  }

  async dlink(fid, accessToken) {
    const resp = await fetch(
      `https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&dlink=1&fsids=[${fid}]&access_token=${accessToken}`,
      {
        headers: {
          'User-Agent': 'pan.baidu.com',
        },
      }
    );
    return await resp.json();
  }
}

export default Client;
