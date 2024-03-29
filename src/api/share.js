import { deepFileList } from '../util.js';

const API_URL = 'https://pan.baidu.com';

class Client {
  constructor(surl, pwd, bduss) {
    this.surl = surl;
    this.pwd = pwd;
    this.headers = {
      'User-Agent': 'netdisk',
      Cookie: `BDUSS=${bduss}; ndut_fmt=`,
      Referer: 'https://pan.baidu.com/disk/home',
    };
  }

  async getShareInfo() {
    const resp1 = await fetch(`${API_URL}/share/wxlist?channel=weixin&version=2.2.2&clienttype=25&web=1`, {
      method: 'POST',
      headers: this.headers,
      body: `pwd=${this.pwd}&shorturl=${this.surl}&root=1`,
    });

    const result = await resp1.json();
    if (result.errno != 0) {
      throw new Error('获取分享信息失败，errno=' + result.errno);
    }
    return result.data;
  }

  /**
   * 递归获取所有文件列表
   */
  async getFileList() {
    return await deepFileList(this._doGetList.bind(this), '');
  }

  /**
   * 获取指定文件下载链接
   * @param fid
   * @returns
   */
  async getDlink(fid) {
    const { uk, shareid, seckey } = await this.getShareInfo();

    const signResp = await fetch(
      `${API_URL}/share/tplconfig?fields=sign,timestamp&channel=chunlei&web=1&app_id=250528&clienttype=0&surl=${this.surl}`,
      {
        headers: this.headers,
      }
    );
    const signResult = await signResp.json();
    if (signResult.errno != 0) {
      throw new Error('获取签名失败，errno=' + signResult.errno);
    }
    const { sign, timestamp } = signResult.data;

    const durlResp = await fetch(
      `${API_URL}/api/sharedownload?app_id=250528&channel=chunlei&clienttype=12&web=1&sign=${sign}&timestamp=${timestamp}`,
      {
        method: 'POST',
        headers: this.headers,
        body: `encrypt=0&extra={"sekey":"${seckey}"}&fid_list=[${fid}]&primaryid=${shareid}&product=share&type=nolimit&uk=${uk}`,
      }
    );
    const durlResult = await durlResp.json();
    if (durlResult.errno != 0) {
      throw new Error('获取下载链接失败，errno=' + durlResult.errno);
    }
    return durlResult.list[0].dlink;
  }

  async _doGetList(dir) {
    const root = dir === '' ? 1 : 0;

    // 分页加载当前目录下所有文件
    let page = 1;
    let hasMore = true;
    let list = [];
    while (hasMore) {
      const data = await this._doGetPageList(dir, root, page);
      list = list.concat(data.list);
      hasMore = data.has_more;
      page++;
    }

    return list;
  }

  async _doGetPageList(dir, root, page) {
    const resp = await fetch('https://pan.baidu.com/share/wxlist?channel=weixin&version=2.2.2&clienttype=25&web=1', {
      method: 'POST',
      headers: this.headers,
      body: `dir=${encodeURIComponent(dir)}&num=1000&order=time&page=${page}&pwd=${this.pwd}&root=${root}&shorturl=${
        this.surl
      }`,
    });
    const result = await resp.json();
    if (result.errno != 0) {
      throw new Error('解析文件列表失败，errno=' + result.errno);
    }
    return result.data;
  }
}

export default Client;
