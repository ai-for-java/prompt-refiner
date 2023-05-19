import {Component} from '@angular/core';
import {Observable} from 'rxjs';


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

interface RequestResponse {
  request: string;
  response: string;
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

  analyzePrompt(value: string): void {
    const regex = /\{\{([^\}]*)\}\}/g;
    let match;
    while (match = regex.exec(value)) {
      const placeholderId = match[1].trim();
      if (placeholderId && !this.prompt.userPromptInputs.some(input => input.id === placeholderId)) {
        this.prompt.userPromptInputs.push({id: placeholderId, text: ''});
      }
    }
  }

  clearModel(): void {
    this.config.model = '';
  }

  addInput() {
    this.prompt.userPromptInputs.push({id: '', text: ''});
  }

  removeInput(index: number) {
    this.prompt.userPromptInputs.splice(index, 1);
  }

  callAPI() {

    const timestamp = Date.now().toString();
    localStorage.setItem(timestamp, this.prompt.userPrompt);

    let finalPrompt = this.prompt.userPrompt;
    for (const input of this.prompt.userPromptInputs) {
      finalPrompt = finalPrompt.replace(`{{${input.id}}}`, input.text);
    }

    const messages = [
      {
        role: 'user',
        content: finalPrompt,
      },
    ];
    if (this.prompt.systemPrompt.trim() !== '') {
      messages.unshift({role: 'system', content: this.prompt.systemPrompt});
    }
    const body = {
      model: this.config.model,
      messages,
      temperature: +this.config.temperature,
      stream: true
    };

    // Log headers and body
    console.log('Request: ', body);

    this.requestsAndResponses.unshift({
      response: '',
      request: `Model: ${this.config.model}\nTemperature: ${this.config.temperature}\n\nSystem Prompt: ${this.prompt.systemPrompt}\n\nUser Prompt: ${this.prompt.userPrompt}`
    });

    for (const input of this.prompt.userPromptInputs) {
      this.requestsAndResponses[0].request += `\n${input.id}: ${input.text}`;
    }

    this.chatStream(
      'https://api.openai.com/v1/chat/completions',
      JSON.stringify(body, null, 4),
      ''
    ).subscribe();
  }

  requestsAndResponses: RequestResponse[] = [];

  // ...
  chatStream(url: string, body: string, apikey: string) {
    const self = this;

    return new Observable<string>(observer => {
      fetch(url, {
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apikey}`,
        },
      }).then(response => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!response.ok) {
          console.info(response)
          alert(response);
          observer.error();
        }

        function push() {
          return reader?.read().then(({done, value}) => {
            if (done) {
              observer.complete();
              return;
            }

            //parse text content from response
            const events = decoder.decode(value).split('\n\n');
            let content = '';
            for (let i = 0; i < events.length; i++) {
              const event = events[i];
              if (event === 'data: [DONE]') {
                const timestamp = Date.now().toString();
                localStorage.setItem(timestamp + "-response", self.requestsAndResponses[0].response);
                break;
              }
              if (event && event.slice(0, 6) === 'data: ') {
                const data = JSON.parse(event.slice(6));
                let partialResponse = data.choices[0].delta?.content || '';
                console.log(partialResponse);
                self.requestsAndResponses[0].response += partialResponse; // Use the captured reference 'self'
                content += partialResponse;
              }
            }
            observer.next(content);
            push();
          }).catch((err: Error) => {
            // handle fetch error
            console.error(err)
            alert(err);
            observer.error();
          });
        }

        push();
      }).catch((err: Error) => {
        // handle fetch error
        console.error(err)
        alert(err);
        observer.error();
      });
    });
  }

  maxNumberOfLines(str1: string, str2: string): number {
    return Math.max(this.numberOfLines(str1), this.numberOfLines(str2))
  }

  numberOfLines(str: string): number {
    const matches = str.match(/\n/g);
    return matches ? matches.length + 1 : 1;
  }
}
