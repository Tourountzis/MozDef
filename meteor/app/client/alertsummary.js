/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at http://mozilla.org/MPL/2.0/.
Copyright (c) 2014 Mozilla Corporation

Contributors:
Jeff Bryner jbryner@mozilla.com
Anthony Verez averez@mozilla.com
 */

if (Meteor.isClient) {
    
    //register a dependency we can control via the count
    //of alerts instead of subscribing to the large
    //alerts table.
    var alertsDep = new Deps.Dependency;
    var currentCount=0

    Template.alertssummary.events({
        "click .reset": function(e,t){
            Session.set('alertsearchtext','');
            dc.filterAll();
            dc.redrawAll();
            },
        "click .ipmenu-whois": function(e,t){
            Session.set('ipwhoisipaddress',($(e.target).attr('data-ipaddress')));
            $('#modalwhoiswindow').modal()
        },
        "click .ipmenu-dshield": function(e,t){
            Session.set('ipdshieldipaddress',($(e.target).attr('data-ipaddress')));
            $('#modaldshieldwindow').modal()
        },        
        "click .ipmenu-blockip": function(e,t){
            Session.set('blockIPipaddress',($(e.target).attr('data-ipaddress')));
            $('#modalBlockIPWindow').modal()
        },
        "click .dropdown": function(e,t){
            console.log(e);
            $(e.target).addClass("hover");
            $('ul:first',$(e.target)).css('visibility', 'visible');            
            
        },
        "keyup #alertsearchtext": function(e,t){
            var code = e.which;
            if(code==13){//enter
                e.preventDefault();
                Session.set('alertsearchtext',$('#alertsearchtext').val());
            }
        }
        
    });   
 
    Template.alertssummary.alertsTotalCount = function () {
        alertsDep.depend();
        return currentCount;
    };
    
    Template.alertssummary.rendered = function() {
        var ringChartCategory   = dc.pieChart("#ringChart-category");
        var ringChartSeverity   = dc.pieChart("#ringChart-severity");
        var volumeChart         = dc.barChart("#volumeChart");
        
        var ndx = crossfilter();

        function descNumbers(a, b) {
            return b-a;
        }
        
        function isIPv4(entry) {
          var blocks = entry.split(".");
          if(blocks.length === 4) {
            return blocks.every(function(block) {
              return parseInt(block,10) >=0 && parseInt(block,10) <= 255;
            });
          }
          return false;
        }         
        
        ipHighlight=function(anelement){
          var words=anelement.text().split(' ');
          //console.log(words);
          words.forEach(function(w){
            if ( isIPv4(w) ){
                //console.log(w);
              anelement.
                highlight(w,
                          {wordsOnly:true,
                           element: "em",
                          className:"ipaddress"});
            }
          });
        };
        
        addBootstrapIPDropDowns=function(){
            //bootstrap version: disabled for now due to getElementByID bug in v2 until mozdef meets bootstrap v3.
            //fix up anything with an ipaddress class
            //by making them into a pull down bootstrap menu                
            $( '.ipaddress').each(function( index ) {
                iptext=$(this).text();
                //add a caret so it looks drop downy
                $(this).append('<b class="caret"></b>');
              
                //wrap the whole thing in a dropdown class
                $(this).wrap( "<span class='dropdown' id='ipdropdown" + index + "'></span>" );
    
                //add the drop down menu
                ipmenu=$("<ul class='dropdown-menu' role='menu' aria-labelledby='dLabel" + index + "'>'");
                whoisitem=$("<li><a class='ipmenu-whois' data-ipaddress='" + iptext + "'href='#'>whois</a></li</ul>");
                dshielditem=$("<li><a class='ipmenu-dshield' data-ipaddress='" + iptext + "'href='#'>dshield</a></li>");
                blockIPitem=$("<li><a class='ipmenu-blockip' data-ipaddress='" + iptext + "'href='#'>block</a></li</ul>");
                
                ipmenu.append(whoisitem,dshielditem,blockIPitem);
                
                $('#ipdropdown'+index).append(ipmenu);
              
                //wrap just the ip in a bootstrap dropdown with a unique id
                $(this).wrap( "<a class='dropdown-toggle' data-toggle='dropdown' href='#' id='dLabel" + index +"'></a>" );
            });                        
        };

        addIPDropDowns=function(){
            //fix up anything with an ipaddress class
            //by making them into a pull down menu driven by jquery                
            $( '.ipaddress').each(function( index ) {
                iptext=$(this).text();
                //add a caret so it looks drop downy
                $(this).append('<b class="caret"></b>');
              
                //wrap the whole thing in a ul dropdown class
                $(this).wrap( "<ul class='dropdown'><li><a href='#'></a><li></ul>" );

                //add the drop down menu
                ipmenu=$("<ul class='sub_menu'>");
                whoisitem=$("<li><a class='ipmenu-whois' data-ipaddress='" + iptext + "'href='#'>whois</a></li>");
                dshielditem=$("<li><a class='ipmenu-dshield' data-ipaddress='" + iptext + "'href='#'>dshield</a></li>");
                blockIPitem=$("<li><a class='ipmenu-blockip' data-ipaddress='" + iptext + "'href='#'>block</a></li>");
                
                ipmenu.append(whoisitem,dshielditem,blockIPitem);
                
                $(this).parent().parent().append(ipmenu);              
            });

        };
        
        
        refreshAlertsData=function(){
            var alertsData=alerts.find({summary: {$regex:Session.get('alertsearchtext')}},{fields:{events:0,eventsource:0}, sort: {utcepoch: 'desc'}, limit: 100, reactive:false}).fetch();
            //parse, group data for the d3 charts
            alertsData.forEach(function (d) {
                d.url = getSetting('kibanaURL') + '#/dashboard/script/alert.js?id=' + d.esmetadata.id;
                d.jdate=new Date(Date.parse(d.utctimestamp));
                d.dd=moment.utc(d.utctimestamp)
                d.month = d.dd.get('month');
                d.hour = d.dd.get('hour')
                d.epoch=d.dd.unix();
            });
            //deps.autorun gets called with and without dc/ndx initialized
            //so check if we used to have data
            //and if we no longer do (search didn't match)
            //clear filters..redraw.
            if ( alertsData.length === 0 && ndx.size()>0){
                console.log('clearing ndx/dc.js');
                dc.filterAll();
                ndx.remove();
                dc.redrawAll();
            } else {
                ndx = crossfilter(alertsData);
            }
            
            if ( ndx.size() >0){             
                var all = ndx.groupAll();
                var severityDim = ndx.dimension(function(d) {return d.severity;});
                var categoryDim = ndx.dimension(function(d) {return d.category;});
                var hourDim = ndx.dimension(function (d) {return d3.time.hour(d.jdate);});
                var epochDim = ndx.dimension(function(d) {return d.utcepoch;});
                var format2d = d3.format("02d");
                var volumeByHourGroup = hourDim.group().reduceCount();

                ringChartCategory
                    .width(150).height(150)
                    .dimension(categoryDim)
                    .group(categoryDim.group())
                    .label(function(d) {return d.key; })
                    .innerRadius(30)
                    .expireCache();
        
                ringChartSeverity
                    .width(150).height(150)
                    .dimension(severityDim)
                    .group(severityDim.group())
                    .label(function(d) {return d.key; })
                    .innerRadius(30)
                    .expireCache();
                dc.dataCount(".record-count")
                    .dimension(ndx)
                    .group(all);            
                dc.dataTable(".alerts-data-table")
                    .dimension(epochDim)
                    .size(100)
                    .group(function (d) {
                            //return d.dd.getFullYear() + "/" + format2d(d.dd.getMonth() + 1) + "/" + format2d(d.dd.getDate());
                            //return moment.duration(d.dd).humanize() +' ago';
                            return d.dd.local().format("ddd, hA"); 
                            })
                    .sortBy(function(d) {
                        return d.utcepoch;
                    })
                    .order(descNumbers)                    
                    .columns([
                        function(d) {return d.jdate;},
                        function(d) {return '<a href="/alert/' + d.esmetadata.id + '">mozdef</a><br> <a href="' + d.url + '">kibana</a>';},
                        function(d) {return d.severity;},
                        function(d) {return d.category;},
                        function(d) {
                            //create a jquery object of the summary
                            //and send it through iphighlight to append a class to any ip address we find
                            var colObj=$($.parseHTML('<span>' + d.summary + '</span>'))
                            ipHighlight(colObj);
                            
                            //return just the html we created as the column
                            return colObj.prop('outerHTML');
                            }
                        ])
                    .on('postRedraw',addIPDropDowns)
                    .on('postRender',addIPDropDowns)
                    .expireCache();
                
                volumeChart
                    .width(600)
                    .height(150)
                    .dimension(hourDim)
                    .group(volumeByHourGroup)
                    .x(d3.time.scale().domain([moment(hourDim.bottom(1)[0].dd).subtract('hours', 1)._d, moment(hourDim.top(1)[0].dd).add('hours', 1)._d]))
                    .expireCache();
                dc.renderAll();
            }
    
        };
        
        Deps.autorun(function(comp) {
            //console.log(comp);
            Meteor.subscribe("alerts-count");
            cnt=alertsCount.findOne();
            $('#alertsearchtext').val(Session.get('alertsearchtext'));
            if ( cnt ){
                alertsDep.changed();
                currentCount=cnt.count;
                Deps.nonreactive(refreshAlertsData);
            }
        
        }); //end deps.autorun    
    };
 

};