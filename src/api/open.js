import gopeed from 'gopeed';
import { deepFileList } from '../util.js';

const API_URL = 'https://pan.baidu.com/rest/2.0';
const ACCESS_TOKEN_KEY = 'accessToken';

class Client {
  constructor(clientId, clientSecret, refreshToken) {
    this.appId = clientId;
    this.secret = clientSecret;
    this.refreshToken = refreshToken;
    this.headers = {
      'User-Agent': 'netdisk',
    };
  }

  // 调用百度接口，并自动处理access_token过期问题
  async _doRequest(path, params) {
    // 重试3次
    for (let i = 0; i < 3; i++) {
      params.access_token = await this._refreshAccessToken(this.refreshToken);
      const paramsStr = Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join('&');
      const res = await fetch(`${API_URL}${path}?${paramsStr}`, {
        headers: this.headers,
      });
      const data = await res.json();
      if (data.errno != 0) {
        // access_token 过期处理，移除缓存
        if ([111, -6].includes(data.errno)) {
          gopeed.storage.remove(ACCESS_TOKEN_KEY);
          continue;
        }
        throw new Error('接口调用失败，path=' + path + ', errno=' + data.errno);
      }
      return data;
    }
  }

  async getFileList(dir) {
    const list = await deepFileList(this._doGetList.bind(this), dir, 2);
    return list;
  }

  async _doGetList(dir) {
    var start = 0;
    var limit = 200;
    var params = {
      method: 'list',
      dir,
      web: 'web',
      order: 'name',
    };

    const fileList = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      params.start = start;
      params.limit = limit;
      start += limit;

      const data = await this._doRequest('/xpan/file', params);
      if (data.list.length == 0) {
        break;
      }
      fileList.push(
        ...data.list.map((e) => {
          e.path = encodeURIComponent(e.path);
          return e;
        })
      );
    }
    return fileList;
  }

  async _refreshAccessToken(refreshToken) {
    var accessToken = gopeed.storage.get(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      const resp = await fetch(
        `https://openapi.baidu.com/oauth/2.0/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=iYCeC9g08h5vuP9UqvPHKKSVrKFXGa1v&client_secret=jXiFMOPVPCWlO2M5CwWQzffpNPaGTRBG`
      );
      const data = await resp.json();
      accessToken = data.access_token;
      gopeed.storage.set(ACCESS_TOKEN_KEY, accessToken);
    }
    return accessToken;
  }

  async getDlink(fid) {
    const params = {
      method: 'filemetas',
      fsids: `[${fid}]`,
      dlink: 1,
    };
    const data = await this._doRequest('/xpan/multimedia', params);
    return `${data.list[0].dlink}&access_token=${await this._refreshAccessToken(this.refreshToken)}`;
  }
}

export default Client;
