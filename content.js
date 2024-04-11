// // @ts-check

// {
//     "tStartMs": 0,
//     "dDurationMs": 7000,
//     "segs": [
//         {
//             "utf8": "Translator: Joseph Geni\nReviewer: Ivana Korom"
//         }
//     ]
// }

var languageCode = "en";
let subUrl;
var subtitleData;
var subtitleDataTime;
var lineTimes = [];
var video;
var divWrap;

async function retry(
  action,
  retryInterval = 5000,
  maxAttemptCount = 3,
  conditions
) {
  const exceptions = [];
  for (let attempted = 0; attempted < maxAttemptCount; attempted++) {
    // console.log('retry', attempted + 1, conditions);
    if (conditions()) {
      console.log("retry done");
      return;
    }
    try {
      if (attempted > 0) {
        await sleep(retryInterval);
      }
      action();
    } catch (e) {
      exceptions.push(e);
    }
  }

  return exceptions;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function millisToMinutesAndSeconds(millis) {
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

var getClosest = (data, value) => {
  const closest = data.reduce(function (prev, curr) {
    return Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev;
  });
  return closest;
};

let lastCurrent = null;
let lastCurrentTime = null;
function getElement(time) {
  if (lastCurrent) {
    const lastTime = lastCurrent.id.split('_item_')[1];
    if (parseFloat(lastTime < time)) {
      const parent = lastCurrent.parentElement;
      const children = [...parent.children];
      const index = children.indexOf(lastCurrent);
      while (index < children.length - 1) {
        const t = children[index + 1].id.split('_item_')[1];
        if (parseFloat(t) >= time) {
          return children[index + 1];
        }
      }
    }
  }
  return null;

}

// We need to find a closest time that is later(larger) than value.
var getClosestNew = (value) => {
  if (value == 0) {
    return lineTimes[0];
  }
  if (lastCurrentTime) {
    //Back
    if (lastCurrentTime.value > value) {
      if (lastCurrentTime.index == 0) {
        return lastCurrentTime;
      }
      if (lastCurrentTime.index > 0 && lineTimes[lastCurrentTime.index - 1].value < value) {
        return lastCurrentTime;
      }
      if (lastCurrentTime.value - 10 < value) {
        let index = lastCurrentTime.index - 1;
        while (index >= 0 && lineTimes[index].value > value) {
          index--;
        }
        if (index >= 0) {
          return lineTimes[index];
        }
      }
    } else
      if (lastCurrentTime.value == value) {
        return lastCurrentTime;
      } else {
        //Forward
        if (lastCurrentTime.index == lineTimes.length - 1) {
          return lastCurrentTime;
        }
        if (lastCurrentTime.value + 10 > value) {
          let index = lastCurrentTime.index + 1;
          while (index < lineTimes.length && lineTimes[index].value < value) {
            index++;
          }
          if (index < lineTimes.length) {
            return lineTimes[index];
          }
        }
      }
  }
  const closest = lineTimes.reduce(function (prev, curr) {
    if (curr.value == value) {
      return curr;
    }
    if (prev.value == value) {
      return prev;
    }
    if (curr.value > value) {
      if (prev.value < value) {
        return curr;
      } else {
        return Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev;
      }
    }
    if (curr.value < value) {
      if (prev.value > value) {
        return prev;
      } else {
        return Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev;
      }
    }
  });
  return closest;
};

var turnOffAutoSub = () => {
  clearInterval(window.loopAutoScroll);
};

function sendMessageToBackend(message) {
  message.sender = 'youtube_subtitle_extractor';
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  })
}

function findPositionOfNthOccurrence(mainString, subString, n) {
  let count = 0;
  let startIndex = 0;
  let position;

  // Loop to find the n-th occurrence of the subString
  while (count < n) {
    position = mainString.indexOf(subString, startIndex);
    if (position === -1) {
      // If the subString is not found, break out of the loop
      break;
    }
    startIndex = position + subString.length; // Move the start index past the current match
    count++; // Increment the count of occurrences found
  }

  // If the loop exited without finding n occurrences, return -1
  if (count < n) {
    return -1;
  }

  // Return the position of the n-th occurrence
  return position;
}

let lastScrollTo;
var turnOnAutoSub = () => {
  if (window.loopAutoScroll) {
    turnOffAutoSub();
  }

  window.loopAutoScroll = setInterval(() => {
    const currentTime = video.currentTime;
    const scrollTo = getClosest(lineTimes, currentTime);
    if (scrollTo == lastScrollTo) {
      return;
    }
    let substringToFind = '||||';//`-${scrollTo.value.toFixed(2)}-`;
    // Select all span elements within the div
    const spanElements = divWrap.querySelectorAll('span');

    // Loop through each span element
    spanElements.forEach(span => {
      // Get the text content of the span
      const spanText = span.textContent;

      // Replace the span with its text content
      span.parentNode.insertBefore(document.createTextNode(spanText), span);

      // Remove the original span element
      span.remove();
    });
    // const position = divWrap.innerHTML.indexOf(substringToFind)
    position = findPositionOfNthOccurrence(divWrap.innerHTML, substringToFind, scrollTo.index);
    if (position !== -1) {
      var highlightedDiv = document.createElement('span');
      highlightedDiv.innerHTML = substringToFind;
      highlightedDiv.style.color = 'red'; // Highlight the substring
      highlightedDiv.setAttribute('index', scrollTo.index);

      // Replace the original substring in the div with the highlighted version
      divWrap.innerHTML = divWrap.innerHTML.slice(0, position) + highlightedDiv.outerHTML + divWrap.innerHTML.slice(position + substringToFind.length);
      const span = divWrap.querySelector('span')
      span.scrollIntoViewIfNeeded();
    }
  }, 150);
};

if (window.ytInitialPlayerResponse) {
  var contextkk =
    window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer
      .captionTracks;
  subUrl = contextkk.find((k) => k.languageCode === languageCode);

  var makeList = (data) => {
    console.log("makeList", data.length);
    video = document.getElementsByTagName("video")[0];
    // console.log("video", video);
    let allTextArea = document.getElementById("seek-youtube-all-text");
    let allText = '';
    let subtitlesText = '';
    // let copyButton;
    if (!allTextArea) {
      allTextArea = document.createElement("div");
      allTextArea.id = "seek-youtube-all-text";
      allTextArea.style.height = "20px";
      allTextArea.style.overflow = "hidden";
      allTextArea.style.overflowY = "auto";
    }
    divWrap = document.getElementById("seek-youtube_wrap");
    // console.log("divWrap1", divWrap);
    if (!divWrap) {
      divWrap = document.createElement("div");
    }
    // console.log("divWrap2", divWrap);

    // const ul = document.createElement("ul");

    data.forEach((el) => {
      const { segs = [], tStartMs } = el;
      const t = (tStartMs / 1000) //millisToMinutesAndSeconds(tStartMs);
      const timeString = `-${t.toFixed(2)}-`;

      allText += '||||'; //timeString;
      // subtitlesText += '||||';

      segs.map((k) => {
        allText += k.utf8.toString();
        subtitlesText += k.utf8.toString();
        // return k.utf8
      })
      lineTimes.push({ index: lineTimes.length, value: t });// tStartMs / 1000 });
    });

    divWrap.innerHTML = allText;

    divWrap.id = "seek-youtube_wrap";
    divWrap.style.height = video.style.height;
    divWrap.style.zIndex = 999;
    divWrap.style.background = "white";
    divWrap.style.top = "80px";
    divWrap.style.right = "0";
    divWrap.style.fontSize = "14px";
    divWrap.style.padding = "24px 24px";
    divWrap.style.marginRight = "24px";
    divWrap.style.overflow = "auto";
    divWrap.style.border = "1px solid";
    divWrap.style.transition = "transform 1s";

    let divSecondary = document.getElementById("secondary");
    divSecondary.prepend(divWrap);
    // allTextArea.textContent = subtitlesText;
    // divSecondary.prepend(allTextArea);

    // start auto jum sub
    // turnOnAutoSub();

    divWrap.addEventListener("mouseover", function (ev) {
      turnOnAutoSub();
    });

    divWrap.addEventListener("mouseleave", function (ev) {
      turnOffAutoSub()
    });

    video.addEventListener("ended", function (e) {
      turnOffAutoSub();
    });
  };

  (async () => {
    try {
      const resData = await fetch(subUrl?.baseUrl + "&fmt=json3").then((res) =>
        res.json()
      );
      // console.log("resData", resData);
      subtitleData = resData?.events.filter(
        (k) =>
          k?.segs &&
          Boolean(
            ` ${k?.segs
              .map((k) => k.utf8)
              .toString()
              .replaceAll(", ", " ")}`.trim()
          )
      );
      subtitleDataTime = resData?.events.map((k) => k.tStartMs / 1000);
    } catch (error) {
      console.log(error);
    }

    if (subtitleData) {
      console.log("runnnn");

      await retry(
        () => { },
        2000,
        50,
        () => {
          return document.getElementById("secondary");
        }
      );
      makeList(subtitleData);
    }
  })();
}
