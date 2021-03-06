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

    //elastic search cluster template functions
    //return es health items
    Template.mozdefhealth.esclusterhealthitems = function () {
        return healthescluster.find();
    };

    Template.mozdefhealth.frontendhealthitems = function () {
        return healthfrontend.find();
    };

    Template.mozdefhealth.esnodeshealthitems = function () {
        return healthesnodes.find();
    };

    Template.mozdefhealth.eshotthreadshealthitems = function () {
        return healtheshotthreads.find();
    };

    Template.mozdefhealth.helpers({
      lastupdate: function() {
        var obj = healthfrontend.findOne();
        if (obj) {
          return obj.utctimestamp;
        }
        else {
          return;
        }
      }
    });

 
   Template.mozdefhealth.rendered = function () {
        var ringChartEPS   = dc.pieChart("#ringChart-EPS");
        var totalEPS   = dc.numberDisplay("#total-EPS");
        var ringChartLoadAverage = dc.pieChart("#ringChart-LoadAverage");
        var frontEndData=healthfrontend.find({}).fetch();
        var ndx = crossfilter(frontEndData);
        var hostDim  = ndx.dimension(function(d) {return d.hostname;});
        var hostEPS = hostDim.group().reduceSum(function(d) {return d.details.total_deliver_eps.toFixed(2);});
        var hostLoadAverage = hostDim.group().reduceSum(function(d) {return d.details.loadaverage[0];});
        var epsTotal = ndx.groupAll().reduceSum(function(d) {return d.details.total_deliver_eps;});
        
        totalEPS
            .valueAccessor(function(d){return d;})
            .group(epsTotal);
        
        ringChartEPS
            .width(150).height(150)
            .dimension(hostDim)
            .group(hostEPS)
            .label(function(d) {return d.value; })
            .innerRadius(30);

        ringChartLoadAverage
            .width(150).height(150)
            .dimension(hostDim)
            .group(hostLoadAverage)
            .label(function(d) {return d.value; })
            .innerRadius(30);
        dc.renderAll();
        Deps.autorun(function() {
            frontEndData=healthfrontend.find({}).fetch();
            ndx.remove();
            ndx.add(frontEndData);
            dc.redrawAll();
        }); //end deps.autorun
     };
}