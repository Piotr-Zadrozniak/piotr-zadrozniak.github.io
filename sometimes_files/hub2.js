
(async function() {
  let connection = new signalR.HubConnectionBuilder()
      .withUrl("/hub")
      .withAutomaticReconnect([0, 1000, 5000, null])
      .configureLogging(signalR.LogLevel.Information)
      .build();

  await connection.start();

  connection.on("ReceiveMessage", (message) => {
    onMessage(message);
  });

  function onMessage(message) {
    console.log('message recieved:', message);

    let data = JSON.parse(message);

    // {"uId":211859, type:"Message","cId":"6072392597521825798","mIdxs":"6137479562717560852"}

    if (data.type === 'encodingProgress') {
      let pieceEl = document.querySelector(`#piece_${data.pieceId}`);

      if (!pieceEl) {
        console.log(`#piece_${data.pieceId} not found`);

        return;
      }

      CM.Piece.get(pieceEl).setProgress(data);
    }
    else if (data.type === 'backupProgress') {
      let blockEl = document.querySelector('#backupNotification');

      blockEl.classList.remove('closed');
      blockEl.classList.add('open');

      let meterEl = blockEl.querySelector('.meter');

      meterEl.style.width = (data.progress * 100) + 'px';
      blockEl.querySelector('.description').textContent = data.message;
    }
    else if (data.cId && CM.messages.conversationId) {
      if (data.cId == CM.messages.conversationId.toString()) {
        CM.messages.appendMessage(data.cId, data.mId);
      }
      else {
        CM.messages.reloadList();
      }
    }
  }

})();
