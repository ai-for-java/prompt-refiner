import {Component} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';

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
    }
  ];
}

interface Prompt {
  main: string;
  inputs: Input[];
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
  responses: String[] = [];
  config = {
    model: 'gpt-3.5-turbo',
    temperature: 0.0
  };
  prompt: Prompt = {
    main: '',
    inputs: [],
  };

  constructor(private http: HttpClient) {
  }

  addInput() {
    this.prompt.inputs.push({id: '', text: ''});
  }

  removeInput(index: number) {
    this.prompt.inputs.splice(index, 1);
  }

  callAPI() {
    let finalPrompt = this.prompt.main;
    for (const input of this.prompt.inputs) {
      finalPrompt = finalPrompt.replace(`\${${input.id}}`, input.text);
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer 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`,
    };
    const body = {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: finalPrompt,
        },
      ],
      temperature: +this.config.temperature,
    };

    // Log headers and body
    console.log('Request Headers:', headers);
    console.log('Request Body:', body);

    this.http
      .post<APIResponse>('https://api.openai.com/v1/chat/completions', body, {headers})
      .subscribe(
        (data: APIResponse) => {
          const responseContent = data.choices[0]?.message;
          if (responseContent) {
            this.responses.unshift(data.choices[0].message.content +
              '\n\n' +
              '################################################################\n' +
              '################################################################\n\n'
              + 'Prompt: ' + finalPrompt + '\n'
              + 'Model: ' + this.config.model + '\n'
              + 'Temperature: ' + this.config.temperature);
          }
          console.log('Response:', data);
        },
        (error) => {
          console.error(error);
        }
      );
  }
}
