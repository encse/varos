#include <fstream.h>
#include <stdlib.h>
int Random(int a)
{ return random()%a;
}
main()
{ ofstream out("autok.txt");
  ifstream in("terkep.txt");
  int maxauto;
  cout << "autok szama:";
  cin >> maxauto;

  int fugg;
  int vizsz;
  in >> fugg;
  in >> vizsz;
  int vmeretek[fugg+1];
  int fmeretek[vizsz+1];
  vmeretek[0]=0;
  in >> vmeretek[1];
  vmeretek[1]++;
  for(int i=2;i<=fugg+1;i++)
  { int s;
    in >> s;
    vmeretek[i]=vmeretek[i-1]+s+2;
  }
  fmeretek[0]=0;
  in >> fmeretek[1];
  fmeretek[1]++;
  for(int i=2;i<=vizsz+1;i++)
  { int s;
    in >> s;
    fmeretek[i]=fmeretek[i-1]+s+2;
  }
  int a,x,y;
  int kesz=0;
  out << maxauto << endl;
  while(kesz<maxauto)
  { a=Random(10);
    if (a)
    { a=Random(4)+1;
      out << a << " ";
      a=Random(4);
      switch(a)
      { case 0:
	  x=vmeretek[Random(fugg)+1]+1;
	  y=fmeretek[vizsz+1];
	break;
	case 1:
	  x=0;
	  y=fmeretek[Random(vizsz)+1]+1;
	break;
	case 2:
	  x=vmeretek[Random(fugg)+1];
	  y=0;
	break;
	case 3:
	  x=vmeretek[fugg+1];
	  y=fmeretek[Random(vizsz)+1];
      }
      out << x << " " << y << " " << a << " "<< Random(7)+1 << " ";
      a=Random(20);
      for(int i=0;i<Random(2)+2;i++) out << "2 ";
      for(int i=0;i<a;i++) out << Random(3)+1 << " ";
      for(int i=0;i<20;i++) out << "2 ";
      out << 0;
      out << endl;
      kesz++;
    }
    else
    { out << a << " " << endl;
    }
  }

}
