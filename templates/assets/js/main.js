/* ============================================================
   莱洛丝 LightNotes · 前端交互脚本
   明暗切换 / Tab 切换 / 点赞 / 分享 / 回到顶部 / 移动端导航
   ============================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "ln-color-scheme";
  var LIKE_KEY = "ln-liked";

  /* ---------- 工具 ---------- */
  function $(selector, ctx) {
    return (ctx || document).querySelector(selector);
  }

  function $all(selector, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(selector));
  }

  function getStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

  function getLikedSet() {
    try {
      return JSON.parse(getStorage(LIKE_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function showToast(message) {
    var toast = $("#ln-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("show");
    }, 2200);
  }

  /* ---------- 明暗模式 ---------- */
  function applyColorScheme(dark, persist) {
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    /* 同步 Halo 插件组件（搜索 / 评论）的公共配色标记 */
    root.classList.toggle("color-scheme-dark", dark);
    root.classList.toggle("color-scheme-light", !dark);
    root.setAttribute("data-color-scheme", dark ? "dark" : "light");
    if (persist) setStorage(STORAGE_KEY, dark ? "dark" : "light");
  }

  function initThemeToggle() {
    var btn = $("#ln-theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var dark = !document.documentElement.classList.contains("dark");
      applyColorScheme(dark, true);
    });
  }

  /* 跟随系统切换（用户未手动选择时） */
  function initSystemSchemeListener() {
    if (!window.matchMedia) return;
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var handler = function (e) {
      if (!getStorage(STORAGE_KEY)) applyColorScheme(e.matches, false);
    };
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
    }
  }

  /* ---------- 首页 Tab 切换 ---------- */
  function initTabs() {
    var tabBar = $("#ln-tabs");
    if (!tabBar) return;
    var buttons = $all(".tab-btn", tabBar);
    var panels = $all(".tab-panel[data-panel]");

    function activate(name) {
      buttons.forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("active", panel.getAttribute("data-panel") === name);
      });
    }

    var defaultTab = tabBar.getAttribute("data-default") || "moments";
    // 服务器端已通过 th:classappend 设置初始 active 状态，JS 只负责用户手动切换
    // 读取当前已激活的 tab，确保与模板输出一致
    var activeBtn = $(".tab-btn.active", tabBar);
    if (activeBtn) {
      defaultTab = activeBtn.getAttribute("data-tab");
    }

    tabBar.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".tab-btn") : null;
      if (!btn) return;
      activate(btn.getAttribute("data-tab"));
    });
  }

  /* ---------- 说说点赞 ---------- */
  function markLikedState() {
    var liked = getLikedSet();
    $all(".ln-like").forEach(function (btn) {
      var key = btn.getAttribute("data-group") + "/" + btn.getAttribute("data-name");
      if (liked.indexOf(key) !== -1) btn.classList.add("liked");
    });
  }

  function initLikeButtons() {
    markLikedState();

    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".ln-like") : null;
      if (!btn || btn.classList.contains("liked")) return;

      var group = btn.getAttribute("data-group");
      var plural = btn.getAttribute("data-plural");
      var name = btn.getAttribute("data-name");
      if (!group || !plural || !name) return;

      btn.disabled = true;

      fetch("/apis/api.halo.run/v1alpha1/trackers/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: group, plural: plural, name: name }),
      })
        .then(function (res) {
          // 后端成功时为 200 但响应体可能为空，无需解析 JSON
          if (!res.ok) throw new Error("upvote failed");
        })
        .then(function () {
          btn.classList.add("liked");
          var count = $(".ln-like-count", btn);
          if (count) count.textContent = parseInt(count.textContent, 10) + 1 || 1;
          var liked = getLikedSet();
          liked.push(group + "/" + name);
          setStorage(LIKE_KEY, JSON.stringify(liked));
        })
        .catch(function () {
          showToast("点赞失败了，稍后再试试～");
        })
        .finally(function () {
          btn.disabled = false;
        });
    });
  }

  /* ---------- 分享 / 复制链接 ---------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand("copy") ? resolve() : reject();
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(input);
      }
    });
  }

  function initShareButtons() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".ln-share") : null;
      if (!btn) return;
      e.preventDefault();

      var path = btn.getAttribute("data-share-url") || window.location.pathname;
      var url = new URL(path, window.location.origin).href;

      copyText(url)
        .then(function () {
          showToast("链接已复制到剪贴板");
        })
        .catch(function () {
          showToast(url);
        });

      /* 关闭所在的下拉菜单 */
      var menu = btn.closest("details.more-menu");
      if (menu) menu.removeAttribute("open");
    });
  }

  /* ---------- 背景插画 ---------- */
  function initBackground() {
    var bg = $("#ln-bg");
    if (!bg) return;
    var image = bg.getAttribute("data-bg");
    var blur = bg.getAttribute("data-blur");
    if (image) {
      bg.style.backgroundImage = "url('" + image + "')";
    }
    if (blur) {
      bg.style.filter = "blur(" + blur + "px)";
    }
  }

  /* ---------- 回到顶部 ---------- */
  function initBackToTop() {
    var btn = $("#ln-top");
    if (!btn) return;

    var onScroll = function () {
      btn.classList.toggle("visible", window.scrollY > 320);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- 友链申请表单展开/收起 ---------- */
  function initLinkApply() {
    var toggle = $("[data-ln-apply-toggle]");
    var panel = $("[data-ln-apply-panel]");
    if (!toggle || !panel) return;

    toggle.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
    });

    // 从其它页面跳转锚点 #add 到达时自动展开并滚动
    if (window.location.hash === "#add" && panel.hidden) {
      panel.hidden = false;
      setTimeout(function () {
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }

  /* ---------- 热门标签数量限制 ---------- */
  function initHotTags() {
    var box = $("#ln-hot-tags");
    if (!box) return;
    var limit = parseInt(box.getAttribute("data-limit"), 10);
    if (!limit || limit <= 0) return;

    var pills = $all(".tag-pill", box);
    pills.sort(function (a, b) {
      return (parseInt(b.getAttribute("data-count"), 10) || 0) -
        (parseInt(a.getAttribute("data-count"), 10) || 0);
    });
    pills.forEach(function (pill, index) {
      if (index >= limit) pill.style.display = "none";
    });
  }

  /* ---------- 移动端导航 ---------- */
  function initNavToggle() {
    var toggle = $("#ln-nav-toggle");
    var header = $(".site-header");
    if (!toggle || !header) return;

    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---------- 用户头像与悬浮菜单 ---------- */
  function initUserMenu() {
    var box = $("#ln-user-box");
    if (!box) return;

    var entry = $("#ln-user-entry", box);

    function open() {
      box.classList.add("open");
      if (entry) entry.setAttribute("aria-expanded", "true");
    }

    function close() {
      box.classList.remove("open");
      if (entry) entry.setAttribute("aria-expanded", "false");
    }

    /* 桌面端：悬停展开 */
    box.addEventListener("mouseenter", open);
    box.addEventListener("mouseleave", close);

    /* 触屏 / 点击：点按切换 */
    if (entry) {
      entry.addEventListener("click", function (e) {
        e.stopPropagation();
        if (box.classList.contains("open")) {
          close();
        } else {
          open();
        }
      });
    }

    /* 点击其它区域或按 Esc 收起 */
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target)) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    /* 拉取当前登录用户信息，填充头像（与 theme-clarity 相同接口） */
    fetch("/apis/api.console.halo.run/v1alpha1/users/-")
      .then(function (res) {
        if (!res.ok) throw new Error("current user not found");
        return res.json();
      })
      .then(function (data) {
        var user = data && data.user;
        var userName = user && user.metadata ? user.metadata.name : null;
        if (!userName || userName === "anonymousUser") return;
        var displayName = (user.spec && user.spec.displayName) || userName;
        var avatar = user.spec && user.spec.avatar;

        var img = $("#ln-user-avatar", box);
        var fallback = $("#ln-user-avatar-fallback", box);
        if (avatar && img) {
          /* 头像加载失败时回退到占位图标 */
          img.onerror = function () {
            img.setAttribute("hidden", "");
            if (fallback) fallback.style.display = "";
          };
          img.src = avatar;
          img.alt = displayName;
          img.removeAttribute("hidden");
          if (fallback) fallback.style.display = "none";
        }
        if (img) img.title = displayName;
      })
      .catch(function () {
        /* 接口异常时保留默认占位头像 */
      });
  }

  /* ---------- 欢迎卡片头像轮播 ---------- */
  function initWelcomeCarousel() {
    var carousel = $("#ln-welcome-carousel");
    if (!carousel) return;

    var items = carousel.querySelectorAll(".welcome-avatar");
    if (items.length < 2) return;

    var interval = parseInt(carousel.getAttribute("data-interval"), 10);
    if (!interval || interval <= 0) interval = 3;

    var index = 0;
    window.setInterval(function () {
      items[index].classList.remove("is-active");
      index = (index + 1) % items.length;
      items[index].classList.add("is-active");
    }, interval * 1000);
  }

  /* ---------- 标签页标题切换 ---------- */
  function initTabTitleSwitch() {
    var cfg = window.lnPage || {};
    if (!cfg.tabTitleSwitch) return;

    var originalTitle = document.title;
    var titleTimer = null;
    var hideTimer = null;
    var returnTimer = null;

    function clearTimers() {
      if (titleTimer) {
        window.clearTimeout(titleTimer);
        titleTimer = null;
      }
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
      if (returnTimer) {
        window.clearTimeout(returnTimer);
        returnTimer = null;
      }
    }

    document.addEventListener("visibilitychange", function () {
      clearTimers();
      if (document.hidden) {
        // 切出：延迟修改为切出标题
        hideTimer = window.setTimeout(function () {
          document.title = cfg.tabTitleLeave || originalTitle;
          hideTimer = null;
        }, cfg.tabTitleLeaveDelay || 50);
      } else {
        // 切回：延迟显示欢迎标题，再延迟恢复原标题
        returnTimer = window.setTimeout(function () {
          document.title = cfg.tabTitleReturn || originalTitle;
          returnTimer = null;
          titleTimer = window.setTimeout(function () {
            document.title = originalTitle;
            titleTimer = null;
          }, cfg.tabTitleRestoreDelay || 3000);
        }, cfg.tabTitleReturnDelay || 0);
      }
    });
  }

  /* ---------- 外链安全提示 ---------- */
  function initExternalLinkPrompt() {
    var cfg = window.lnPage || {};
    if (!cfg.externalLinkPrompt) return;

    var root = document.documentElement;
    var MAIN_DOMAIN = window.location.hostname;
    var themeStyles = {
      light: {
        dialogBg: "#fff",
        leftBg: "linear-gradient(135deg, #f8f9ff 0%, #e8f4f8 100%)",
        maskBg: "rgba(0,0,0,0.6)",
        titleColor: "#2c3e50",
        textColor: "#666",
        cancelBtnBg: "#f5f5f5",
        cancelBtnHoverBg: "#e9e9e9",
        cancelBtnColor: "#666",
        rightImageBg: "#f0f0f0"
      },
      dark: {
        dialogBg: "#1e1e2e",
        leftBg: "linear-gradient(135deg, #282838 0%, #1e293b 100%)",
        maskBg: "rgba(0,0,0,0.8)",
        titleColor: "#e2e8f0",
        textColor: "#a1a1aa",
        cancelBtnBg: "#2d2d3f",
        cancelBtnHoverBg: "#38384f",
        cancelBtnColor: "#e2e8f0",
        rightImageBg: "#252535"
      }
    };

    // 取注册域（如 www.example.com -> example.com），站点子域名视作站内
    function getRootDomain(hostname) {
      var parts = hostname.split(".");
      if (parts.length <= 2) return hostname;
      return parts.slice(-2).join(".");
    }

    function isExternalLink(url) {
      if (!url || url.indexOf("javascript:") === 0 || url.indexOf("mailto:") === 0 || url.indexOf("tel:") === 0) {
        return false;
      }
      try {
        var host = new URL(url, window.location.origin).hostname;
        return getRootDomain(host) !== getRootDomain(MAIN_DOMAIN);
      } catch (e) {
        return false;
      }
    }

    function getCurrentTheme() {
      return root.getAttribute("data-color-scheme") === "dark" ? "dark" : "light";
    }

    function showSafeConfirmDialog(targetUrl) {
      var theme = getCurrentTheme();
      var styles = themeStyles[theme];

      var mask = document.createElement("div");
      mask.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;background:" + styles.maskBg +
        ";z-index:9998;backdrop-filter:blur(2px);transition:background 0.3s";

      var dialog = document.createElement("div");
      dialog.style.cssText =
        "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;padding:0;background:" +
        styles.dialogBg +
        ";border:none;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.15);z-index:9999;width:680px;" +
        "max-width:90vw;height:380px;max-height:90vh;overflow:hidden;font-family:'LXGWWenKai','PingFang SC','Microsoft YaHei',sans-serif;transition:background 0.3s";

      var leftContent = document.createElement("div");
      leftContent.style.cssText =
        "flex:1;padding:40px 30px;background:" + styles.leftBg +
        ";display:flex;flex-direction:column;justify-content:center;transition:background 0.3s";
      leftContent.innerHTML =
        '<div style="margin-bottom:15px">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#e74c3c" stroke-width="2"/><path d="M12 8V12L15 15" stroke="#e74c3c" stroke-width="2" stroke-linecap="round"/></svg></div>' +
        '<h3 style="margin:0 0 15px;color:' + styles.titleColor + ';font-size:22px;font-weight:600">安全访问提示</h3>' +
        '<p style="margin:0 0 10px;color:' + styles.textColor + ';line-height:1.6;font-size:14px">你即将离开本站，跳转到外部网站：</p>' +
        '<p style="margin:0 0 25px;color:#e74c3c;font-weight:500;font-size:15px;word-break:break-all">' + targetUrl + "</p>" +
        '<p style="margin:0 0 30px;color:' + styles.textColor + ';line-height:1.6;font-size:14px">外部网站可能存在未知的安全风险，<br>请确认是否继续访问？</p>' +
        '<div style="display:flex;gap:15px">' +
        '<button id="safe-confirm-btn" style="padding:12px 30px;background:#3498db;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:15px;font-weight:500;transition:all 0.2s">确认访问</button>' +
        '<button id="safe-cancel-btn" style="padding:12px 30px;background:' + styles.cancelBtnBg + ";color:" + styles.cancelBtnColor +
        ';border:none;border-radius:6px;cursor:pointer;font-size:15px;font-weight:500;transition:all 0.2s">取消</button>' +
        "</div>";

      var rightImage = document.createElement("div");
      rightImage.style.cssText =
        "width:280px;flex-shrink:0;height:100%;position:relative;overflow:hidden;background:" +
        styles.rightImageBg + ";transition:background 0.3s";
      var imageUrl = cfg.externalLinkImage || "/upload/safepage.png";
      rightImage.innerHTML =
        '<img src="' + imageUrl +
        '" alt="安全提示" style="position:absolute;bottom:0;right:0;width:100%;height:100%;object-fit:cover;object-position:bottom right;transform:scale(1.05)">';

      dialog.appendChild(leftContent);
      dialog.appendChild(rightImage);
      document.body.appendChild(mask);
      document.body.appendChild(dialog);

      var confirmBtn = document.getElementById("safe-confirm-btn");
      var cancelBtn = document.getElementById("safe-cancel-btn");

      function closeDialog() {
        document.body.removeChild(dialog);
        document.body.removeChild(mask);
        observer.disconnect();
      }

      confirmBtn.addEventListener("mouseenter", function () {
        confirmBtn.style.background = "#2980b9";
      });
      confirmBtn.addEventListener("mouseleave", function () {
        confirmBtn.style.background = "#3498db";
      });
      cancelBtn.addEventListener("mouseenter", function () {
        cancelBtn.style.background = themeStyles[getCurrentTheme()].cancelBtnHoverBg;
      });
      cancelBtn.addEventListener("mouseleave", function () {
        cancelBtn.style.background = themeStyles[getCurrentTheme()].cancelBtnBg;
      });

      confirmBtn.addEventListener("click", function () {
        window.open(targetUrl, "_blank");
        closeDialog();
      });
      cancelBtn.addEventListener("click", closeDialog);
      mask.addEventListener("click", closeDialog);

      // 跟随主题切换（监听 html 的 class / data-color-scheme 变化）
      var observer = new MutationObserver(function () {
        var current = getCurrentTheme();
        var s = themeStyles[current];
        dialog.style.background = s.dialogBg;
        leftContent.style.background = s.leftBg;
        mask.style.background = s.maskBg;
        dialog.querySelector("h3").style.color = s.titleColor;
        rightImage.style.background = s.rightImageBg;
      });
      observer.observe(root, { attributes: true });
    }

    document.addEventListener("click", function (e) {
      var target = e.target;
      var link = target && target.closest ? target.closest("a") : null;
      if (!link) return;
      var url = link.href;
      if (isExternalLink(url)) {
        e.preventDefault();
        showSafeConfirmDialog(url);
      }
    });
  }

  /* ---------- 文章页目录导航 ---------- */
  function initPostToc() {
    var nav = $("#ln-toc-nav");
    var emptyTip = $("#ln-toc-empty");
    var article = $(".post-content");
    if (!nav || !article || !emptyTip) return;

    // 扫描正文标题（h1-h6），无标题时显示空态提示
    var headings = $all("h1,h2,h3,h4,h5,h6", article);
    if (!headings.length) {
      emptyTip.hidden = false;
      return;
    }

    headings.forEach(function (heading, index) {
      if (!heading.id) heading.id = "ln-heading-" + index;

      var level = parseInt(heading.tagName.charAt(1), 10);
      var item = document.createElement("div");
      item.className = "ln-toc-item";
      item.setAttribute("data-level", level);

      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent;
      link.title = heading.textContent;
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var top = heading.getBoundingClientRect().top + window.pageYOffset - 84;
        window.scrollTo({ top: top, behavior: "smooth" });
      });

      item.appendChild(link);
      nav.appendChild(item);
    });

    // 滚动高亮当前标题
    function setActive() {
      var marker = window.pageYOffset + 96;
      var current = headings[0];
      for (var i = 0; i < headings.length; i++) {
        var el = headings[i];
        if (el.getBoundingClientRect().top + window.pageYOffset <= marker) {
          current = el;
        } else {
          break;
        }
      }
      var activeItem = null;
      $all(".ln-toc-item", nav).forEach(function (item) {
        var link = item.querySelector("a");
        var isActive = link && link.getAttribute("href") === "#" + current.id;
        item.classList.toggle("is-active", isActive);
        if (isActive) activeItem = item;
      });
      // 让当前项在可滚动的右栏内保持可见
      if (activeItem) {
        var aside = $(".post-aside");
        if (aside) {
          var r = aside.getBoundingClientRect();
          var er = activeItem.getBoundingClientRect();
          if (er.top < r.top + 6 || er.bottom > r.bottom - 6) {
            aside.scrollTop += er.top - r.top - 12;
          }
        }
      }
    }

    window.addEventListener("scroll", setActive, { passive: true });
    window.addEventListener("resize", setActive);
    setActive();
  }

  /* ---------- 页脚运行时长 ---------- */
  function initRuntime() {
    var el = $("#ln-runtime");
    if (!el) return;
    var match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(el.getAttribute("data-start") || "");
    if (!match) return;
    var start = new Date(+match[1], +match[2] - 1, +match[3]);

    function pad(n) {
      return n < 10 ? "0" + n : "" + n;
    }
    function update() {
      var diff = Math.max(0, Date.now() - start.getTime());
      var totalSec = Math.floor(diff / 1000);
      var hours = Math.floor(totalSec / 3600);
      var mins = Math.floor((totalSec % 3600) / 60);
      var secs = totalSec % 60;
      el.textContent = hours + "小时" + pad(mins) + "分" + pad(secs) + "秒";
    }
    update();
    window.setInterval(update, 1000);
  }

  /* ---------- 页面加载后初始化 ---------- */
  function init() {
    initThemeToggle();
    initSystemSchemeListener();
    initTabs();
    initLikeButtons();
    initShareButtons();
    initBackground();
    initBackToTop();
    initHotTags();
    initLinkApply();
    initNavToggle();
    initUserMenu();
    initWelcomeCarousel();
    initTabTitleSwitch();
    initExternalLinkPrompt();
    initRuntime();
    initPostToc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
