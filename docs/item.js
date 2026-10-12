// 機器画面（?id=...）：空いていれば使用開始、使用中なら返却
async function initItemPage(app, id) {
  let current = null; // { ok, item, status, message }

  renderHeader((oldName, newName) => {
    // 入力欄が空か、前の保存名のままなら新しい名前に差し替える
    const input = document.getElementById('nameInput');
    if (input && (!input.value.trim() || input.value.trim() === oldName)) input.value = newName;
  });

  const data = await run(null, () => apiGet({ action: 'item', id }));
  if (!data) {
    app.innerHTML = errorCard('読み込みに失敗しました。', '通信状態を確認して、ページを再読み込みしてください。');
    return;
  }
  render(data);

  function render(data, message) {
    current = data;
    if (!data.ok) {
      app.innerHTML = errorCard(data.message, 'QRコードを読み直すか、管理者にお問い合わせください。');
      return;
    }
    const item = data.item;
    const st = data.status;
    const inUse = st.state === '使用中';

    let html = message ? '<div class="msg info">' + esc(message) + '</div>' : '';
    html += '<div class="card">' +
      '<h1>' + esc(item.name) + '</h1>' +
      '<div class="muted">' + esc(item.id) + (item.locationName ? '　/　' + esc(item.locationName) : '') + '</div>' +
      (item.note ? '<div class="muted">' + esc(item.note) + '</div>' : '') +
      stateBadge(st.state, 'state-big');

    if (inUse) {
      html +=
        '<dl class="info">' +
          '<dt>使用者</dt><dd>' + esc(st.user) + '</dd>' +
          '<dt>使用開始</dt><dd>' + esc(st.startAt) + (st.elapsed ? '（' + esc(st.elapsed) + '経過）' : '') + '</dd>' +
        '</dl>' +
        '<label class="field" for="nameInput">返却する人の名前（任意）</label>' +
        '<input type="text" id="nameInput" maxlength="50" autocomplete="name" placeholder="氏名" value="' + esc(NameStore.get()) + '">' +
        '<button class="danger" id="actionBtn">返却する</button>';
    } else {
      if (st.returnAt) {
        html += '<p class="muted">前回：' + esc(st.user) + ' さん（' + esc(st.startAt) + ' 〜 ' + esc(st.returnAt) + '）</p>';
      }
      html +=
        '<label class="field" for="nameInput">使用する人の氏名</label>' +
        '<input type="text" id="nameInput" maxlength="50" autocomplete="name" placeholder="氏名を入力" value="' + esc(NameStore.get()) + '">' +
        '<button class="primary" id="actionBtn">使用開始</button>';
    }
    html += '</div>';
    if (item.locationId) {
      html += '<p class="muted"><a href="' + esc(locationUrl(item.locationId)) + '">' + esc(item.locationName) + ' の一覧を見る</a></p>';
    }
    app.innerHTML = html;
    document.getElementById('actionBtn').addEventListener('click', inUse ? onReturn : onStart);
  }

  async function onStart() {
    const name = document.getElementById('nameInput').value.trim();
    if (!name) {
      await alertDialog('氏名を入力してください。');
      return;
    }
    // 保存済みの名前と違う（または未保存の）ときだけ登録するか聞く
    let register = false;
    if (name !== NameStore.get()) {
      register = await confirmDialog('次回も使えるように、この名前をこの端末に登録しますか？\n\n' + name, 'はい', 'いいえ');
    }
    const res = await run('記録中…', () => apiPost({ action: 'start', id: current.item.id, name }));
    if (!res) return;
    if (!res.ok) return handleFailure(res);
    if (register && !NameStore.set(name)) {
      await alertDialog('この端末（ブラウザ）では名前を保存できませんでした。');
    }
    renderDone('✅', '使用を開始しました', res, '返却するときは、もう一度この機器のQRコードを読み取ってください。', false);
  }

  async function onReturn() {
    const returner = document.getElementById('nameInput').value.trim();
    const user = current.status.user;
    const msg = returner && returner !== user
      ? user + ' さんの使用を、' + returner + ' さんが返却します。よろしいですか？'
      : user + ' さんの使用を返却します。よろしいですか？';
    if (!(await confirmDialog(msg, '返却する', 'キャンセル'))) return;

    const res = await run('記録中…', () => apiPost({ action: 'return', id: current.item.id, returner }));
    if (!res) return;
    if (!res.ok) return handleFailure(res);
    renderDone('↩️', '返却しました', res, '', true);
  }

  // label が null のときは読み込み中表示を出さない（初回表示は画面側に出ている）
  async function run(label, task) {
    try {
      return label ? await withBusy(label, task) : await task();
    } catch (err) {
      await alertDialog('通信エラー：' + err.message);
      return null;
    }
  }

  // 他の人が先に操作していた場合は最新状態で描き直す
  function handleFailure(res) {
    if (res.conflict && res.item) {
      render({ ok: true, item: res.item, status: res.status }, res.message);
    } else {
      alertDialog(res.message || 'エラーが発生しました。');
    }
  }

  function renderDone(icon, title, res, note, offerStart) {
    const st = res.status;
    current = { ok: true, item: res.item, status: st };
    app.innerHTML =
      '<div class="card done">' +
        '<div class="icon">' + icon + '</div>' +
        '<h1>' + esc(title) + '</h1>' +
        '<div><strong>' + esc(res.item.name) + '</strong></div>' +
        '<dl class="info" style="display:inline-grid;text-align:left">' +
          '<dt>使用者</dt><dd>' + esc(st.user) + '</dd>' +
          '<dt>使用開始</dt><dd>' + esc(st.startAt) + '</dd>' +
          (st.returnAt ? '<dt>返却</dt><dd>' + esc(st.returnAt) + '</dd>' : '') +
          (st.returnAt && st.returner && st.returner !== st.user ? '<dt>返却者</dt><dd>' + esc(st.returner) + '</dd>' : '') +
        '</dl>' +
        (note ? '<p class="muted">' + esc(note) + '</p>' : '') +
        (offerStart ? '<button class="primary" id="startAgainBtn">続けて使用開始する</button>' : '') +
      '</div>';
    if (offerStart) {
      document.getElementById('startAgainBtn').addEventListener('click', async () => {
        const data = await run('読み込み中…', () => apiGet({ action: 'item', id: res.item.id }));
        if (data) render(data);
      });
    }
  }
}
