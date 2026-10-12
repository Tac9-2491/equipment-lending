// 状況一覧（?loc=... で設置場所ごと、なしで全機器）
async function initListPage(app, locationId) {
  app.classList.add('wide');
  renderHeader();
  await reload(true);

  function render(data) {
    if (!data.ok) {
      app.innerHTML = errorCard(data.message);
      return;
    }
    const showLocation = !data.location;
    const inUseCount = data.rows.filter((r) => r.status.state === '使用中').length;

    let html =
      '<div class="row">' +
        '<h1>' + esc(data.location ? data.location.name : 'すべての機器') + '</h1>' +
        '<span class="spacer"></span>' +
        '<button class="small" id="reloadBtn">更新</button>' +
      '</div>' +
      '<div class="muted summary">全' + data.rows.length + '台　使用中 ' + inUseCount + '台　空き ' + (data.rows.length - inUseCount) + '台　（' + esc(data.updatedAt) + ' 時点）</div>';

    if (!data.rows.length) {
      html += '<div class="card muted">登録されている機器はありません。</div>';
    } else {
      html += '<div class="table-wrap"><table class="status"><thead><tr>' +
        '<th>機器名</th>' + (showLocation ? '<th>設置場所</th>' : '') +
        '<th>状態</th><th>使用者</th><th>使用開始日時</th><th>返却日時</th>' +
        '</tr></thead><tbody>';
      data.rows.forEach((r) => {
        const st = r.status;
        const inUse = st.state === '使用中';
        const cell = (label, value) => '<td data-label="' + label + '"' + (value ? '' : ' class="empty"') + '>' + esc(value) + '</td>';
        html += '<tr class="' + (inUse ? 'in-use' : '') + '">' +
          '<td class="name"><a href="' + esc(itemUrl(r.item.id)) + '">' + esc(r.item.name) + '</a></td>' +
          (showLocation ? cell('設置場所', r.item.locationName) : '') +
          '<td data-label="状態">' + stateBadge(st.state) + (inUse && st.elapsed ? ' <span class="muted">' + esc(st.elapsed) + '</span>' : '') + '</td>' +
          cell(inUse ? '使用者' : '前回の使用者', st.user) +
          cell('使用開始日時', st.startAt) +
          cell('返却日時', inUse ? '' : st.returnAt) +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    app.innerHTML = html;
    document.getElementById('reloadBtn').addEventListener('click', () => reload(false));
  }

  async function reload(first) {
    try {
      const task = () => apiGet({ action: 'list', loc: locationId });
      render(first ? await task() : await withBusy('更新中…', task));
    } catch (err) {
      if (first) app.innerHTML = errorCard('読み込みに失敗しました：' + err.message, 'ページを再読み込みしてください。');
      else alertDialog('通信エラー：' + err.message);
    }
  }
}
