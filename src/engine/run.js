import {StudentConfiguration} from "./student";
import {StatusState} from "../server";

export class RunConfiguration extends StudentConfiguration {
    use(engine) {
        this.main.model.execution.feedback.message("Running...");
        this.filename = "answer";
        this.code = this.main.model.ui.files.getStudentCode();
        if (this.main.model.assignment.settings.disableStudentRun()) {
            this.code = "";
        }
        //this.code = this.main.model.submission.code();
        this.main.components.server.saveFile("answer.py", this.main.model.submission.code(), null);
        this.main.components.server.logEvent("Compile", "", "", "", "answer.py");
        //console.log(this.code);
        super.use(engine);

        engine.reset();
        this.updateParse();

        this.main.model.execution.reports["verifier"] = {
            "success": Boolean(this.code.trim()),
            "code": this.code
        };

        if (typeof Sk.environ == "undefined") {
            Sk.environ = new Sk.builtin.dict();
        }
        const printerTag = this.main.components.console.printerTag,
            width = printerTag.width()-50,
            height = Math.max(300, printerTag.height()-50);
        Sk.environ.set$item(new Sk.builtin.str("DESIGNER_WINDOW_WIDTH"), new Sk.builtin.int_(Math.round(width)));
        Sk.environ.set$item(new Sk.builtin.str("DESIGNER_WINDOW_HEIGHT"), new Sk.builtin.int_(Math.round(height)));

        Sk.retainGlobals = false;

        this.clearInput();

        return this;
    }

    success(module) {
        console.log("Run success");
        let message = {
            "inputs": this.main.model.execution.input().join("\n"),
            "outputs": this.main.model.execution.output().map(line => line.content).join("\n"),
        };
        this.main.components.server.logEvent("Run.Program", "", "", JSON.stringify(message), "answer.py");
        this.main.model.display.dirtySubmission(false);
        this.main.components.console.finishTurtles();
        this.main.model.status.onExecution(StatusState.READY);
        this.main.model.execution.student.globals(Sk.globals);
        Sk.globals = {};
        let report = this.main.model.execution.reports;
        let filename = this.filename;
        this.main.model.execution.student.results = module;
        if (!this.main.model.assignment.settings.hideEvaluate()) {
            this.main.components.console.beginEval();
        }
        return new Promise((resolve, reject) => {
            this.step(module.$d, module.$d,-1, 0, filename + ".py");
            this.lastStep();
            report["student"] = {
                "success": true,
                "trace": this.engine.executionBuffer.trace,
                "lines": this.engine.executionBuffer.trace.map(x => x.line),
                "realLines": this.engine.executionBuffer.trace.filter(x => !x.isDocstring).map(x => x.line),
                "results": module,
                "output": this.main.model.execution.output,
                "input": this.main.model.execution.input,
                "calls": this.main.model.execution.student.calls,
                "tracing": []
            };
            resolve();
        });
    }

    failure(error) {
        console.error("Run failure", error);
        this.main.model.status.onExecution(StatusState.FAILED);
        let report = this.main.model.execution.reports;
        if (report.parser.success && report.verifier.success) {
            this.main.components.server.logEvent("Compile.Error", "", "", error.toString(), "answer.py");
        } else {
            this.main.components.server.logEvent("Run.Program", "ProgramErrorOutput", "", error.toString(), "answer.py");
        }
        this.lastStep();
        return new Promise((resolve, reject) => {
            report["student"] = {
                "success": false,
                "error": error,
                "trace": this.engine.executionBuffer.trace,
                "lines": this.engine.executionBuffer.trace.map(x => x.line),
                "realLines": this.engine.executionBuffer.trace.filter(x => !x.isDocstring).map(x => x.line),
                "input": this.main.model.execution.input,
                "calls": this.main.model.execution.student.calls,
                "tracing": []
            };
            resolve();
        });
    }
}