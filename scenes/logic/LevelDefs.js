export const LEVEL_NAMES = [
    'FALSE CONFIDENCE','THE FIRST BETRAYAL','DOUBLE DEPENDENCY',
    'ORDER CONTROLS REALITY','TIME IS A WEAPON','SELF-SABOTAGE',
    'CHAIN OF CONSEQUENCES','PARALLEL EXECUTION','NO MISTAKES ALLOWED',
    "THE ARCHITECT'S TRIAL"
];

export const DIALOGUES = [
    { start:['...Hello?','Is anyone there?','That green light…','It feels important.'],       end:['It reacted…','Like it was waiting for me.'] },
    { start:['Wait… what was that?','I just saw… myself.'],                                    end:["That wasn't a reflection.",'It followed me.'] },
    { start:["So it's real…",'Another version of me.'],                                        end:['We can work together.','We have to.'] },
    { start:['This feels familiar…',"Like I've already failed here."],                         end:['Every move stays.','Nothing is erased.'] },
    { start:["It's not just movement…","It's timing."],                                        end:['I can control this.','If I think ahead.'] },
    { start:['Why are they in my way?',"They're… me."],                                        end:["My past doesn't just help…",'It can trap me.'] },
    { start:["This isn't random.","There's a pattern."],                                       end:['Everything connects.','Step by step.'] },
    { start:['There are too many of us now…','But somehow… it makes sense.'],                  end:['Each one of me…','Has a purpose.'] },
    { start:['I see it now…','The whole plan.','C first. Then A. Then B.'],                    end:['One mistake…','And everything collapses.'] },
    { start:['All the loops…','All the paths…','They were leading here.'],                     end:["I wasn't trapped in the loop…",'I was building it.'] },
];

export const LEVEL_DEFS = [
    {
        maxLoops:1, playerStart:{x:1,y:7}, goal:{x:7,y:1},
        plates:[], doors:[], walls:[]
    },
    {
        maxLoops:2, playerStart:{x:1,y:4}, goal:{x:7,y:4},
        plates:[{x:2,y:4,id:'A'}],
        doors:[{x:4,y:4,requiredPlates:['A']}],
        walls:[{x:4,y:1},{x:4,y:2},{x:4,y:3},{x:4,y:5},{x:4,y:6},{x:4,y:7}]
    },
    {
        maxLoops:2, playerStart:{x:4,y:1}, goal:{x:4,y:7},
        plates:[{x:2,y:2,id:'A'},{x:6,y:2,id:'B'}],
        doors:[{x:4,y:4,requiredPlates:['A','B']}],
        walls:[{x:1,y:4},{x:2,y:4},{x:3,y:4},{x:5,y:4},{x:6,y:4},{x:7,y:4},{x:4,y:2},{x:1,y:3},{x:7,y:3}]
    },
    {
        maxLoops:2, playerStart:{x:1,y:4}, goal:{x:7,y:4},
        plates:[{x:2,y:4,id:'A'},{x:5,y:6,id:'B'}],
        doors:[{x:3,y:6,requiredPlates:['A']},{x:6,y:4,requiredPlates:['A','B']}],
        walls:[{x:3,y:1},{x:3,y:2},{x:3,y:3},{x:3,y:4},{x:3,y:5},{x:3,y:7},{x:6,y:1},{x:6,y:2},{x:6,y:3},{x:6,y:5},{x:6,y:6},{x:6,y:7},{x:7,y:2},{x:7,y:3}]
    },
    {
        maxLoops:3, stepLimit:40, playerStart:{x:1,y:7}, goal:{x:7,y:1},
        plates:[{x:1,y:3,id:'A'},{x:7,y:5,id:'B'}],
        fakePlates:[{x:7,y:3},{x:1,y:5}],
        doors:[{x:4,y:3,requiredPlates:['A']},{x:4,y:5,requiredPlates:['B']}],
        walls:[{x:4,y:1},{x:4,y:2},{x:4,y:4},{x:4,y:6},{x:4,y:7},{x:5,y:1},{x:6,y:1},{x:2,y:3},{x:1,y:2},{x:6,y:5},{x:7,y:6}]
    },
    {
        maxLoops:3, playerStart:{x:4,y:1}, goal:{x:4,y:7},
        plates:[{x:1,y:2,id:'A'},{x:7,y:2,id:'B'},{x:4,y:4,id:'C'}],
        fakePlates:[{x:1,y:6},{x:7,y:6}],
        doors:[{x:4,y:3,requiredPlates:['A','B']},{x:4,y:5,requiredPlates:['C']}],
        walls:[{x:2,y:3},{x:3,y:3},{x:5,y:3},{x:6,y:3},{x:2,y:5},{x:3,y:5},{x:5,y:5},{x:6,y:5},{x:2,y:1},{x:1,y:3},{x:6,y:1},{x:7,y:3}]
    },
    {
        maxLoops:3, playerStart:{x:1,y:7}, goal:{x:7,y:7},
        plates:[{x:1,y:3,id:'A'},{x:7,y:3,id:'B'}],
        fakePlates:[{x:1,y:5},{x:7,y:5}],
        doors:[{x:4,y:3,requiredPlates:['A']},{x:4,y:5,requiredPlates:['A','B']}],
        walls:[{x:4,y:1},{x:4,y:2},{x:4,y:4},{x:4,y:6},{x:4,y:7},{x:2,y:3},{x:1,y:2},{x:6,y:3},{x:7,y:2}]
    },
    {
        maxLoops:4, playerStart:{x:4,y:1}, goal:{x:4,y:7},
        plates:[{x:1,y:3,id:'A'},{x:7,y:3,id:'B'},{x:4,y:3,id:'C'}],
        fakePlates:[{x:1,y:6},{x:7,y:6}],
        doors:[{x:4,y:5,requiredPlates:['A','B','C']}],
        walls:[{x:2,y:3},{x:1,y:4},{x:6,y:3},{x:7,y:4},{x:2,y:4},{x:3,y:4},{x:5,y:4},{x:6,y:4},{x:2,y:5},{x:3,y:5},{x:5,y:5},{x:6,y:5},{x:1,y:5},{x:7,y:5},{x:2,y:6},{x:3,y:6},{x:5,y:6},{x:6,y:6}]
    },
    {
        maxLoops:3, stepLimit:45, playerStart:{x:1,y:1}, goal:{x:4,y:7},
        plates:[{x:1,y:4,id:'C'},{x:4,y:4,id:'A'},{x:7,y:4,id:'B'}],
        fakePlates:[{x:1,y:6},{x:7,y:6}],
        doors:[{x:3,y:4,requiredPlates:['C']},{x:6,y:4,requiredPlates:['C','A']},{x:4,y:6,requiredPlates:['C','A','B']}],
        plateHints:{'C':['C first.','It unlocks the path forward.'],'A':['A second.','One more gate to go.'],'B':['B last.','Now the final door opens.']},
        walls:[{x:2,y:4},{x:5,y:4},{x:7,y:3},{x:7,y:5},{x:2,y:6},{x:3,y:6},{x:5,y:6},{x:6,y:6},{x:5,y:1},{x:6,y:1}]
    },
    {
        maxLoops:4, stepLimit:55, playerStart:{x:1,y:1}, goal:{x:4,y:7},
        plates:[{x:1,y:4,id:'A'},{x:7,y:4,id:'B'},{x:4,y:4,id:'C'}],
        fakePlates:[{x:1,y:6},{x:7,y:6}],
        doors:[{x:4,y:3,requiredPlates:['A','B']},{x:4,y:5,requiredPlates:['A','B','C']}],
        walls:[{x:4,y:1},{x:4,y:2},{x:2,y:4},{x:1,y:5},{x:6,y:4},{x:7,y:5},{x:3,y:6},{x:5,y:6},{x:2,y:7},{x:3,y:7},{x:5,y:7},{x:6,y:7}]
    }
];
