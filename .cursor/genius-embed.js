(function(window,document){

    if (!Array.isArray) {
      Array.isArray = function(arg) {
        return Object.prototype.toString.call(arg) === '[object Array]';
      };
    }
    if(window.spilWHH)  {
        if(Array.isArray(window.spilWHH))  {
            for (var index in window.spilWHH) {
                loadembed(window.spilWHH[index]);
            }
        }
        else    {
            loadembed(window.spilWHH);
        }

    }

    function loadembed(userconfig) {
        var config =  {
            'placeHolder' : 'spil_w_h',
            'page' : '/schedule',
            'language' : 'en',
            'width' : '100%',
            'height' : 'auto',
            'raw' : false,
            'rawEnableCSS' : true,
            'rawEnableJS' : true,
            'internalURL' : '',
            'showLinks' : true,
            'showTitle' : false,
            'showSubMenus' : false,
            'showCompetitionChooser' : false,
            'showLanguageChooser' : false,
            'showNavBar' : false,
            'showMatchFilter' : false,
            'blockDisplay' : ''
        };
        if(userconfig)  {
            for (var key in userconfig) {
                config[key] = userconfig[key];
            }
        }
        if(config.page.indexOf('/') != 0)  {
            config.page = '/' + config.page;
        }
        var hostname = document.location.hostname;
        var allowedDomains = ['hosted.dcd.shared.geniussports.com','statshubph.info','nxgensports.com','nxgensports.ph','pybc.ph','football-widget-catalog-prod.eu-west-1.elasticbeanstalk.com'];

        function endsWith(str, suffix) {
            a = str.indexOf(suffix, str.length - suffix.length) !== -1;
            return str.indexOf(suffix, str.length - suffix.length) !== -1;
        }
        
        var allowed = 0;
        for (var index in allowedDomains) {
            if(endsWith(hostname,allowedDomains[index]))    {
                allowed = 1;
            }
        }

        var placeholder = document.getElementById(config.placeHolder);
        var qs = window.location.search;
        var WHurlIndex = qs.indexOf('WHurl');
        if(WHurlIndex > 0)  {
            config.page = decodeURIComponent(qs.substr(WHurlIndex + 'WHurl='.length));
        }
        
        const pagePathREGEX = /^\/?(([\da-zA-Z一-龠ぁ-ゔァ-ヴー々〆〤ヶ]+\/?)*)\??([\s\da-zA-Z一-龠ぁ-ゔァ-ヴー々〆〤ヶ]+\=[\/\s\da-zA-Za-zA-Z一-龠ぁ-ゔァ-ヴー々〆〤ヶà-üÀ-Ü'\+\-\ª-º\.]*\&?)*$/;

        if(pagePathREGEX.test(config.page)) {
			if(!config['internalURL']) {
				config['internalURL'] = window.location.origin + window.location.pathname + window.location.search;
			}

          if(config['raw'] == true) {
              var url = "https://hosted.dcd.shared.geniussports.com/embednf/PRS/" + config.language + config.page;
              if (url.indexOf('?_lng') !== -1) {
                  var removeOldLang = "?_lng=" + getParameterByName('_lng', url);
                  url = url.replace(removeOldLang, "");
              }

              if(url.indexOf('&_lng') == -1) {
                  if(url.indexOf('?') == -1) {
                      url = url + '?';
                  }
              } else {
                  url = url.replace(/&_lng/, "?_lng");
              }
              if(config['internalURL'] && config['showLinks'] && url.indexOf('&iurl=') == -1) {
                  url = url + '&iurl=' + encodeURIComponent(config['internalURL']);
              }
              if(!allowed)    {
                  url = "https://hosted.dcd.shared.geniussports.com/embednf/PRS/" + config.language + '/invalidreferrer';
              }
              if(config['showLinks'] == false && url.indexOf('&_hl=') == -1)   {
                  url = url + '&_hl=1';
              }
              if(config['blockDisplay'] && url.indexOf('&_bl=') == -1)   {
                  url = url + '&_bl=' + config['blockDisplay'];
              }
              if(config['showTitle'] == false && url.indexOf('&_ht=') == -1)   {
                  url = url + '&_ht=1';
              }
              if(config['showSubMenus'] == false && url.indexOf('&_hsm=') == -1)   {
                  url = url + '&_hsm=1';
              }
              if(config['showCompetitionChooser'] == true && url.indexOf('&_cc=') == -1)   {
                  url = url + '&_cc=1';
              }
              if(config['showLanguageChooser'] == true && url.indexOf('&_lc=') == -1)   {
                  url = url + '&_lc=1';
              }
              if(config['showNavBar'] == true && url.indexOf('&_nv=') == -1)   {
                  url = url + '&_nv=1';
              }
              if(config['showMatchFilter'] == true && url.indexOf('&_mf=') == -1)   {
                  url = url + '&_mf=1';
              }
              if (config['placeHolder'] == 'spil_w_h_schedule') {
                  url = url + '&poolNumber=-1';
              }
              if (url.indexOf('??_lng') !== -1) {
                  url = url.replace("??_lng", "?_lng");
              }
              if (typeof jQuery == 'undefined') {
                  loadjQuery(url, config, placeholder);
              }
              else    {
                  loadJSON(url, processJSON, config, placeholder);
              }
          }
          else {
              var url = "https://hosted.dcd.shared.geniussports.com/PRS/" + config.language + config.page
              if(!allowed)    {
                  url = "https://hosted.dcd.shared.geniussports.com/PRS/" + config.language + '/invalidreferrer';
              }
              if(config['showLinks'] == false)   {
                  url = url + '&_sl=0';
              }
              var iframe = document.createElement('iframe');
              (iframe.frameElement || iframe).style.cssText = "width: 0; height: 0; border:0; scrolling:none;";
              
              iframe.onload = function()  {
                  width = config.width;
                  if(width != 'auto')    {
                      if(width.match(/^[\d]+$/)) {
                          width = width + 'px';
                      }
                      iframe.style.width = width;
                  }
                  iframe.style.width = width;
                  height = config.height;
                  if(height != 'auto')    {
                      if(height.match(/^[\d]+$/)) {
                          height = height + 'px';
                      }
                      iframe.style.height = height;
                  }
              }

              receiveSize = function(e){
                  if (e.origin === "https://hosted.dcd.shared.geniussports.com") {
                      dimensions = e.data.split(":");
                      
                      if(config.width == 'auto')  {
                          iframe.style.width = dimensions[0] + 'px';
                      }
                      if(config.height == 'auto')  {
                          iframe.style.height = dimensions[1] + 'px';
                      }
                  }
              }
              window.addEventListener("message", receiveSize, false);

              iframe.src = url;
              placeholder.appendChild(iframe);
          }
        }
    }

    function getParameterByName(name, url) {
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    function loadJSON(url, callback, config, placeholder) {   

      var xobj = new XMLHttpRequest();
      xobj.overrideMimeType("application/json");
      xobj.open('GET', url, true);
      xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == "200") {
          callback(xobj.responseText, config, placeholder);
        }
      };
      xobj.send(null);
    }
    function loadjQuery(url, config, placeholder) {
        var script = document.createElement('script');
        script.type = "text/javascript";
        script.src = 'https://code.jquery.com/jquery-3.2.1.min.js';
        //script.onload = script.onreadystatechange = function () {
            //loadJSON(url, processJSON);
        //}
        if(!window._loadingjq)   {
            window._loadingjq = 1;
            document.getElementsByTagName('head')[0].appendChild(script);
        }
            waitJQuery(url, config, placeholder);
    }

    function waitJQuery(url, config, placeholder)
    {
        if (typeof jQuery == 'undefined') {
            setTimeout(function() {waitJQuery(url,config, placeholder)},100);
        }
        else {
            loadJSON(url, processJSON, config, placeholder);
        }
    }

    function processJSON(response,config, placeholder)  {
          json = JSON.parse(response);
          if(json.css && config.rawEnableCSS == true) {
            for (var filenameIndex in json.css) {
                if (jQuery('link[href*="'+ json.css[filenameIndex] + '"]').length === 0) {
                    var link = document.createElement('link')
                    link.setAttribute('rel', 'stylesheet')
                    link.setAttribute('type', 'text/css')
                    link.setAttribute('href', json.css[filenameIndex])
                    document.getElementsByTagName('head')[0].appendChild(link)
                }
            }
          }
          if(json.js && config.rawEnableJS == true) {
            for (var filenameIndex in json.js) {
                if (jQuery('script[src*="'+ json.js[filenameIndex] + '"]').length === 0) {
                    var scr = document.createElement('script')
                    scr.setAttribute('type', 'text/javascript')
                    scr.setAttribute('src', json.js[filenameIndex])
                    document.getElementsByTagName('head')[0].appendChild(scr)
                }
            }
          }
          jQuery(placeholder).append(json.html);
    }

})(window,document);


