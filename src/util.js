/**
 * 获取文件列表，并且深度遍历文件夹里面的文件
 * @param {*} fetchFileList 用于获取单个目录下的文件列表函数
 * @param {*} rootDir 指定开始的根目录
 * @param {*} depth 指定深度
 */
export async function deepFileList(fetchFileList, rootDir, depth) {
  const fileList = [];
  var currentDepth = 1;

  async function deepList(list, currentDepth) {
    for (const file of list) {
      if (file.isdir == 1) {
        if (depth && currentDepth >= depth) {
          continue;
        }
        await deepList(await fetchFileList(file.path), currentDepth + 1);
      } else {
        fileList.push(file);
      }
    }
  }

  await deepList(await fetchFileList(rootDir), currentDepth);
  return fileList;
}
