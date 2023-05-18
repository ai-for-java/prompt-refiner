import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface APIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: [
    {
      index: number;
      message: {
        role: string;
        content: string;
      };
      finish_reason: string;
      delta: {
        content: string;
      };
    }
  ];
}

interface Prompt {
  systemPrompt: string;
  userPrompt: string;
  userPromptInputs: Input[];
}

interface Input {
  id: string;
  text: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'Prompt Refiner';

  config = {
    model: 'gpt-3.5-turbo',
    temperature: 0.0,
  };
  prompt: Prompt = {
    userPrompt: '',
    systemPrompt: '',
    userPromptInputs: [],
  };

  constructor(private http: HttpClient, private zone: NgZone) {}

  addInput() {
    this.prompt.userPromptInputs.push({ id: '', text: '' });
  }

  removeInput(index: number) {
    this.prompt.userPromptInputs.splice(index, 1);
  }

  callAPI() {
    let finalPrompt = this.prompt.userPrompt;
    for (const input of this.prompt.userPromptInputs) {
      finalPrompt = finalPrompt.replace(`\${${input.id}}`, input.text);
    }

    const messages = [
      {
        role: 'user',
        content: finalPrompt,
      },
    ];
    if (this.prompt.systemPrompt.trim() !== '') {
      messages.unshift({ role: 'system', content: this.prompt.systemPrompt });
    }
    const body = {
      model: this.config.model,
      messages,
      temperature: +this.config.temperature,
      stream: true
    };

    // Log headers and body
    console.log('Request: ', body);

    this.responses.unshift('')

    this.chatStream(
      'https://api.openai.com/v1/chat/completions',
      body,
      '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'
    ).subscribe();
  }

  responses: string[] = [];

  // ...
  chatStream(url: string, body: any, apikey: string) {
    const self = this; // Capture reference to 'this'
    return new Observable<string>(observer => {
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apikey}`,
        },
      }).then(response => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!response.ok) {
          console.info(response)
          // handle response error
          observer.error();
        }

        function push() {
          return reader?.read().then(({ done, value }) => {
            if (done) {
              observer.complete();
              return;
            }

            //parse text content from response
            const events = decoder.decode(value).split('\n\n');
            let content = '';
            for (let i = 0; i < events.length; i++) {
              const event = events[i];
              if (event === 'data: [DONE]') break;
              if (event && event.slice(0, 6) === 'data: ') {
                const data = JSON.parse(event.slice(6));
                let content1 = data.choices[0].delta?.content || '';
                console.log(content1);
                self.responses[0] += content1; // Use the captured reference 'self'
                content += content1;
              }
            }
            observer.next(content);
            push();
          }).catch((err: Error) => {
            // handle fetch error
            console.error(err)
            observer.error();
          });
        }

        push();
      }).catch((err: Error) => {
        // handle fetch error
        console.error(err)
        observer.error();
      });
    });
  }
}
