var gadgets = null;
var bininfo = null;
var gadgetsByOffset = {};
var ropchain = [];

/* Mustache templates */
var templateGadgets = null;
var templateChain = null;
var templateEdit = null;
var templateSettings = null;


/*
 * Local Storage
 */
function saveChain() {
    if(typeof(Storage) !== "undefined")
        localStorage.setItem(bininfo.hash, JSON.stringify(ropchain));
}

function loadChain() {
    try {
        ropchain = JSON.parse(localStorage[bininfo.hash]);
    } catch (e) {
        ropchain = [];
    }
}



/*
 * Chain row controls
 */

function gadgetAdd(offset) {
    var add = {
        id: ropchain.length,
        color: 'active',
        offset: gadgetsByOffset[offset].offset,
        hexoffset: gadgetsByOffset[offset].hexoffset,
        opcodes: gadgetsByOffset[offset].opcodes
    };
    ropchain.push(add);

    printChain();
}

function chainDel(id) {
    ropchain.splice(id, 1);

    /* Reorder the ids :( */
    for (var x=0; x<ropchain.length; x++)
        ropchain[x].id = x;

    printChain();
}

function chainUp(id) {
    if (id === 0)
        return;

    var save = ropchain[id-1];
    ropchain[id-1] = ropchain[id];
    ropchain[id] = save;
    ropchain[id-1].id--;
    ropchain[id].id++;

    printChain();
}

function chainDown(id) {
    if (id+1 >= ropchain.length)
        return;

    var save = ropchain[id+1];
    ropchain[id+1] = ropchain[id];
    ropchain[id] = save;
    ropchain[id+1].id++;
    ropchain[id].id--;

    printChain();
}

function chainColor(id) {

    var colors = [ 'active' , 'info', 'success', 'danger', 'warning' ];
    var index = 0;

    /* No color is defined */
    if (typeof ropchain[id].color === 'undefined') {
        ropchain[id].color = colors[1];
        printChain();
        return;
    }

    /* Find current color index */
    for(index=0; index < colors.length; index++) {
        if (colors[index] == ropchain[id].color)
            break;
    }

    if (index+1 < colors.length)
        ropchain[id].color = colors[index+1];
    else
        ropchain[id].color = colors[0];

    printChain();
}


function setCommentHandler() {
    /* Save comments on every key press */
    $('.comment').change(function() {
        var id = $(this).attr('index');
        ropchain[id].comment = $(this).val();
    });
}


/*
 *  Options header buttons
 */
function optionClear() {
    var r = confirm("This will clear the current chain\n\nAre you sure?");

    if (r == true) {
        ropchain = [];
        printChain();
    }
}

function optionSave() {
    var saveData = JSON.stringify({
        ropchain: ropchain,
        binary: bininfo.binary,
        hash: bininfo.hash
    });

    saveData = encodeURI(saveData);

    var a         = document.createElement('a');
    a.href        = 'data:attachment/txt,' + saveData;
    a.target      = '_blank';
    a.download    = 'chain.rarop';

    document.body.appendChild(a);
    a.click();
    a.parentNode.removeChild(a);
}

function optionCopy() {
    $('#chain input[type=checkbox]').each(function (i) {
        if ($(this).prop('checked') === true) {
            var id = $(this).attr('name');
            var newGadget = {
                id: ropchain.length,
                color: ropchain[id].color,
                offset: ropchain[id].offset,
                hexoffset: ropchain[id].hexoffset,
                opcodes: ropchain[id].opcodes,
                comment: ropchain[id].comment
            }

            /* Add the custom parameter for custom gadgets */
            if (typeof ropchain[id].custom !== 'undefined')
                newGadget.custom = ropchain[id].custom;

            ropchain.push(newGadget);
        }
    });
    printChain();
}

function optionDebug() {

    var data = {
        chain: ropchain,
        term: localStorage.term,
        debugger: localStorage.dbg
    };

    $.post('/debug', data, function (response) {
        if (response.result !== 'ok')
            alert("Error debugging!!!\n\nTry adjusting settings");
    });
}


/*
 * Modals related functions
 */

function chainEdit(id) {

    /* By default we make and add operation */
    var data = {
        id: -1,
        len: (bininfo.info.bin.bits / 8),
        maxlen: (bininfo.info.bin.bits / 4),
        comment: "",
        hexoffset: "",
        action: "Add"
    };

    /* Edit instead of add */
    if (id !== null) {
        data.id = id;
        data.action = "Edit";
        data.comment = ropchain[id].comment;
        data.hexoffset = ropchain[id].hexoffset;
    }

    var rendered = Mustache.render(templateEdit, data);
    $('#modal').html(rendered);
    $('#modal').modal('show');
}


function saveGadget() {

    /* Get form data */
    var id = $('#edit-id').val();
    var comment = $('#edit-comment').val();
    var hexoffset = $('#edit-hexoffset').val();
    hexoffset = hexoffset.replace('0x', '');
    hexoffset = pad(hexoffset, bininfo.info.bin.bits / 4);

    if (id == -1) {     // Add
        var newGadget = {
            id: ropchain.length,
            color: 'warning',
            offset: -1,
            hexoffset: hexoffset,
            opcodes: '',
            comment: comment,
            custom: 1
        };
        ropchain.push(newGadget);
    } else {            //Edit
        ropchain[id].comment = comment;
        ropchain[id].hexoffset = hexoffset;
    }

    $('#modal').modal('hide');
    printChain();
}


function settingsShow() {
    var localDbg = localStorage.dbg;
    var localTerm = localStorage.term;

    var data = {
        debuggers: [],
        terminals: [],
        bp: localStorage[bininfo.hash + "-bp"]
    };

    bininfo.debuggers.forEach(function (dbg) {
        var item = { debugger: dbg }
        if (localDbg === dbg)
            item.selected = true;
        data.debuggers.push(item);
    });

    bininfo.terminals.forEach(function (term) {
        var item = { terminal: term }
        if (localTerm === term)
            item.selected = true;
        data.terminals.push(item);
    });


    var rendered = Mustache.render(templateSettings, data);
    $('#modal').html(rendered);
    $('#modal').modal('show');
}


function settingsSave() {
    /* Get form data */
    var bp = $('#settings-bp').val();
    var dbg = $('#settings-dbg').val();
    var term = $('#settings-term').val();
    bp = bp.replace('0x', '');

    localStorage.setItem(bininfo.hash + "-bp", bp);
    localStorage.setItem('term', term);
    localStorage.setItem('dbg', dbg);

    $('#modal').modal('hide');
}


function filterGadgets() {
    var filter = $('#filter').val();
    var filtered = [];

    console.log("Filtering...");

    /* On empty filter print all */
    if (filter === '') {
        printGadgets({ gadgets: gadgets});
        return;
    }

    var pattern = new RegExp(filter, "i")
    console.log(pattern);

    gadgets.forEach(function (gadget) {
        if (gadget.opcodes.match(pattern))
            filtered.push(gadget);
    });

    console.log("END Filtering...");
    printGadgets({ gadgets: filtered});


}

/*
 * Print templates
*/

function printChain() {
    var data = { gadgets: ropchain};
    var rendered = Mustache.render(templateChain, data);
    $('#chain').html(rendered);
    //applyColor('#tblChain tr');

    /* Save & set handlers */
    setCommentHandler();
    saveChain();

    /* Enable drag & drop */
    var fixHelperModified = function(e, tr) {
        var $originals = tr.children();
        var $helper = tr.clone();
        $helper.children().each(function(index) {
            $(this).width($originals.eq(index).width())
        });
        return $helper;
    };

    var updateIndex = function(e, ui) {
        var origPosition = null;
        var newPosition = null;

        $('input[type=checkbox]', ui.item).each(function (i) {
            origPosition = parseInt($(this).attr('name'));
        });

        $('input[type=checkbox]', ui.item.prev()).each(function (i) {
            newPosition = parseInt($(this).attr('name'));
        });

        /* Fix new pos */
        if (newPosition === null)
            newPosition = 0;
        else if (newPosition < origPosition)
            newPosition++;

        /* Resort array */
        ropchain.move(origPosition, newPosition);
        for (var x=0; x<ropchain.length; x++)
            ropchain[x].id = x;
        printChain();
    };

    $('#tblChain tbody').sortable({
        helper: fixHelperModified,
        stop: updateIndex
    });
    $('#tblChain tbody').disableSelection();
}

function printGadgets(data) {
    //var data = { gadgets: gadgets};
    var rendered = Mustache.render(templateGadgets, data);
    $('#gadgets').html(rendered);
    //applyColor('#tblGadgets tr');
}



function applyColor(element) {
    $(element).each(function (i) {
        $(this).children('td').each(function (j, e) {
            if ($(this).attr('type') === 'opcode') {

                var opcodes = $(this).html();
                var opcode = opcodes.split('; ');
                var colored = "";

                opcode.forEach(function (o) {
                    if (o !== '')
                        colored += hljs.highlightAuto(o).value + "; ";
                });

                $(this).html(colored);
            }
        });
    });
}




/*
 * Initial shitz
 */

$(document).ready(function () {

    /* Handler for search filter */
    $('#searchform').submit(function(e) {
        e.preventDefault();
        filterGadgets();
    });


    /* Get the gadgets and print them */
    $.get('/gadgets', function (result) {

        bininfo = result;
        gadgets = result.gadgets;
        gadgets.forEach(function (g) {
            gadgetsByOffset[g.offset] = g;
        });

        /* Set binary name */
        var filename = bininfo.binary.replace(/\\/g,'/').replace( /.*\//, '' );
        $('#bintitle').html(" &nbsp;for " + filename);

        $.get('/partial/gadgets.hbs', function (template) {
            templateGadgets = template;
            printGadgets({ gadgets: gadgets});
        });

        loadChain(); // Try to load saved chain data
        $.get('/partial/chain.hbs', function (template) {
            templateChain = template;
            printChain();
        });

        $.get('/partial/editgadget.hbs', function (template) {
            templateEdit = template;
        });

        $.get('/partial/settings.hbs', function (template) {
            templateSettings = template;
        });

    });

});
