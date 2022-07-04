'use strict';
function debug(){
  console.log(main('licodeenar', 'article120'));
}

function main(paramID, paramKey){
  //パラメーターをセット
  let maxRepeat = CONF.MAX_REPEAT;
  let maxFetch = CONF.FETCH_MAX;
  let apiURL = CONF.API_URL;
  if(paramKey === 'article240'){
    maxRepeat = 2;
    maxFetch = 20;
  }else if(paramKey === 'article120'){
    maxRepeat = 1;
    maxFetch = 20;
  }else{
    maxRepeat = 1;
    maxFetch = 10;
  }
  apiURL = apiURL.replace('[USER_ID]', paramID);

  // 記事の一覧を取得
  const articles = getArticles(apiURL, maxRepeat, maxFetch);

  //LIKE ランキングを取得
  return likeUserRanking(articles);
}

// --------------------------------------------------
// fetchALLで非同期で処理を行う。記事を取得
function getArticles(apiURL, maxRepeat, maxFetch) {
  let pages = [];


  fetch_repeat:
  for(let repeat = 0; repeat < maxRepeat; repeat++){
    let requests = [];

    // リクエストを生成
    const start = repeat * maxFetch + 1;
    const end = start + maxFetch;
    for(let i = start; i <= end; i++){
      requests.push(apiURL + i);
    }

    // 非同期でまとめて取得
    const responses = UrlFetchApp.fetchAll(requests);

    for(let i = 0; i < maxFetch; i++){
      const json_data = JSON.parse(responses[i].getContentText('UTF-8'))['data'];

      // ユーザ情報を抽出
      pages = pages.concat(json_data['contents']);
      
      // 最後のページだったら終了
      if(json_data.isLastPage === true){
        break fetch_repeat;
      }
    }
  }

  //JSONで結果を返す
  return pages;
}

// --------------------------------------------------
// fetchALLで非同期で処理を行う。記事からLIKEを取得
function likeUserRanking(articles){
  let likeList = [];

  for(let repeat = 0; repeat < articles.length; repeat++){
    let requests = [];

    // リクエストを生成
    const start = repeat * CONF.FETCH_MAX;
    let end = start + CONF.FETCH_MAX;
    if(end > articles.length){
      end = articles.length;
    }

    for(let i = start; i < end; i++){
      //https://note.com/api/v1/note/48931013/likes
      requests.push(CONF.API_LIKE_URL + articles[i].id + '/likes');
      //console.log('記事：' + articles[i].id);
    }

    // 非同期でまとめて取得
    const responses = UrlFetchApp.fetchAll(requests);

    for(let i = 0; i < responses.length; i++){
      const json_data = JSON.parse(responses[i].getContentText('UTF-8'))['data'];

      for(let j = 0; j < json_data['likes'].length; j++){
        likeList = pushList(likeList, 
          json_data['likes'][j].user.urlname, 
          json_data['likes'][j].user.nickname);
      }
    }
  }
  
  //LIKE数順にソート
  likeList.sort( (a, b) => {
    return b[b.length -1] - a[a.length - 1];
  });

  // JSONで結果を返す
  return likeListJSON(likeList);
}

// --------------------------------------------------
// 集計リストを作成する
function pushList(list, key, name){
  let isExist = false;
  for(let i = 0; i < list.length; i++){
    if(list[i][0] === key){
      //Keyが見つかったら +1
      list[i][2] += 1;
      isExist = true;
      break;
    }
  }
  if(!isExist){
    //見つからなかったら追加
    list.push([key, name, 1]);
  }
  return list;
}

// --------------------------------------------------
// 配列をJSONに変換
function likeListJSON(list){
  let json = [];
  let max = CONF.MAX_RANKING;
  if(max > list.length){
    max = list.length;
  }

  for(let i = 0; i < max; i++){
    json.push({
      urlname: list[i][0],
      nickname: list[i][1],
      url: 'https://note.com/' + list[i][0],
      count:  list[i][2]
    });
  }
  return json;
}

