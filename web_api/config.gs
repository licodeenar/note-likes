// --------------------------------------------------
// グローバル定数の定義
const CONF = {
    MAX_RANKING: 50, //ランキングを取得するMAX数
    MAX_REPEAT: 1,//fetchAll()を繰り返すMAX数
    FETCH_MAX: 20,  // fetchAll() で一度にフェッチするページ数
    API_URL: 'https://note.com/api/v2/creators/[USER_ID]/contents?kind=note&disabled_pinned=true&page=',
    API_LIKE_URL: 'https://note.com/api/v1/note/'
  };